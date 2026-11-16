/**
 * docling-serve interno (container `docling`, `DOCLING_URL`): PDF, DOCX e imagem → Markdown,
 * com OCR. Devolve o texto por página (PDF/imagem) para achar as páginas com OCR ruim.
 */
const QUEBRA = "<!-- oc:pagina -->";

/** `message` técnica vai para o log; `paraTela` é o que o síndico lê em /app/base. */
export class ErroDocling extends Error {
  constructor(
    message: string,
    readonly paraTela: string,
  ) {
    super(message);
  }
}
const FORA_DO_AR =
  "O serviço de leitura está fora do ar. Vamos tentar de novo sozinhos; se continuar, use “Ler de novo”.";

interface Item {
  content_layer?: string;
  prov?: { page_no: number }[];
}
interface JsonDocling {
  pages?: Record<string, unknown>;
  texts?: Item[];
  tables?: Item[];
  pictures?: Item[];
}

/**
 * Markdown por página do arquivo (índice 0 = página 1). Página sem nenhum item (escaneada em
 * branco para o OCR) vem como "" — o Docling não põe quebra para ela, então o mapa vem do JSON.
 */
export async function converterDocling(
  bytes: Uint8Array<ArrayBuffer>,
  nome: string,
  mime: string,
): Promise<Paginas> {
  const base = (process.env.DOCLING_URL ?? "http://localhost:5001").replace(/\/+$/, "");
  const form = new FormData();
  form.append("files", new Blob([bytes], { type: mime }), nome);
  form.append("to_formats", "md");
  form.append("to_formats", "json");
  form.append("do_ocr", "true");
  form.append("image_export_mode", "placeholder");
  form.append("md_page_break_placeholder", QUEBRA);
  form.append("abort_on_error", "false");
  let r: Response;
  try {
    r = await fetch(`${base}/v1/convert/file`, {
      method: "POST",
      body: form,
      // Documento grande com OCR pode levar minutos na CPU.
      signal: AbortSignal.timeout(10 * 60_000),
    });
  } catch (e) {
    throw new ErroDocling(`Docling indisponível em ${base}: ${(e as Error).message}`, FORA_DO_AR);
  }
  if (!r.ok)
    throw new ErroDocling(
      `Docling respondeu ${r.status}: ${(await r.text()).slice(0, 300)}`,
      r.status >= 500 ? FORA_DO_AR : `O serviço de leitura recusou o arquivo (código ${r.status}).`,
    );
  const j = (await r.json()) as {
    status?: string;
    errors?: unknown[];
    document?: { md_content?: string | null; json_content?: JsonDocling | null };
  };
  const md = j.document?.md_content;
  if (j.status === "failure" || j.status === "skipped" || md == null)
    throw new ErroDocling(
      `Docling não leu o arquivo (${j.status}): ${JSON.stringify(j.errors ?? []).slice(0, 300)}`,
      "Não foi possível abrir o arquivo. Ele pode estar protegido por senha ou corrompido.",
    );
  return porPagina(md, j.document?.json_content ?? null);
}

export interface Paginas {
  paginas: string[];
  /** false = não deu para saber de qual página é cada parte (tudo está em `paginas[0]`). */
  mapa: boolean;
}

export function porPagina(md: string, json: JsonDocling | null): Paginas {
  const partes = md.split(QUEBRA).map((p) => p.trim());
  const total = Object.keys(json?.pages ?? {}).length;
  if (!total) return { paginas: [partes.join("\n\n")], mapa: true }; // DOCX: sem páginas
  // Páginas com algum item do corpo, na ordem: cada uma é uma parte do Markdown.
  const comItens = [
    ...new Set(
      [...(json!.texts ?? []), ...(json!.tables ?? []), ...(json!.pictures ?? [])]
        .filter((x) => x.content_layer !== "furniture")
        .flatMap((x) => x.prov?.map((p) => p.page_no) ?? []),
    ),
  ].sort((a, b) => a - b);
  const paginas = Array.from({ length: total }, () => "");
  if (comItens.length !== partes.length) {
    // ponytail: mapa não fechou (item em duas páginas, ordem de leitura estranha): tudo na 1ª
    // página; quem chama decide tudo ou nada.
    paginas[0] = partes.join("\n\n");
    return { paginas, mapa: false };
  }
  comItens.forEach((n, k) => (paginas[n - 1] = partes[k]!));
  return { paginas, mapa: true };
}

/**
 * Página com OCR ruim: quase sem texto (página escaneada que o OCR não leu) ou com muitos
 * caracteres estranhos (OCR embaralhado).
 * ponytail: heurística simples; ajustar com documentos reais (página em branco também cai aqui).
 */
export function paginaRuim(md: string): boolean {
  const texto = md
    .replace(/<!--.*?-->/gs, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/[#*_|>`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (texto.length < 80) return true;
  const estranhos = texto.match(/[^\p{L}\p{N}\s.,;:!?()"'ºª°%$§/–—-]/gu)?.length ?? 0;
  const palavras = texto.split(" ");
  // Palavras sem nenhuma vogal e com 4+ letras: sinal clássico de OCR ruim ("rnmrn", "lllh").
  const lixo = palavras.filter(
    (w) => w.length >= 4 && /^\p{L}+$/u.test(w) && !/[aeiouáéíóúâêôãõà]/i.test(w),
  ).length;
  return estranhos / texto.length > 0.08 || lixo / palavras.length > 0.2;
}
