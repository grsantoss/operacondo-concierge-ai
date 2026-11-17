/**
 * Fallback do OCR: páginas que o Docling não leu bem vão para o Claude (leitura de imagem/PDF).
 * Só as páginas ruins são enviadas (pdf-lib recorta o PDF). Uso gravado em `llm_execucoes`.
 */
import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";

/** Erro com texto para o síndico (vai para documentos.leitura_aviso). */
export class ErroLeitura extends Error {}

export const MODELO_LEITURA = process.env.INGESTAO_MODELO ?? "claude-haiku-5-5";
// US$ por milhão de tokens (Haiku 5.5, prompt até 100 mil tokens).
const PRECO = { entrada: 0.1, saida: 0.5 };
const SEPARADOR = "=====PAGINA=====";

const PROMPT = `Transcreva fielmente o texto ${"{alvo}"}, em português, como Markdown.
Mantenha títulos, a numeração de artigos, parágrafos (§), incisos e cláusulas exatamente como estão.
Não resuma, não corrija o conteúdo e não acrescente comentários. Trecho ilegível: [ilegível]. Página sem nenhum texto: responda só [página em branco].
Tabelas viram tabelas Markdown. Ignore carimbos, rubricas e assinaturas.`;

export interface Leitura {
  paginas: string[];
  uso: {
    modelo: string;
    tokensEntrada: number;
    tokensSaida: number;
    custoUsd: number;
    latenciaMs: number;
  };
}

export function fallbackConfigurado(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** `paginas` são índices a partir de 0 (só para PDF). Imagem = uma página. */
export async function lerComClaude(
  bytes: Uint8Array<ArrayBuffer>,
  mime: string,
  paginas: number[],
): Promise<Leitura> {
  let bloco: Anthropic.ContentBlockParam;
  let alvo: string;
  if (mime === "application/pdf") {
    const origem = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const novo = await PDFDocument.create();
    for (const p of await novo.copyPages(origem, paginas)) novo.addPage(p);
    bloco = {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: Buffer.from(await novo.save()).toString("base64"),
      },
    };
    alvo =
      paginas.length > 1
        ? `de cada uma das ${paginas.length} páginas deste PDF, na ordem, separando as páginas com uma linha contendo só ${SEPARADOR}`
        : "desta página";
  } else {
    bloco = {
      type: "image",
      source: {
        type: "base64",
        media_type: mime as "image/png" | "image/jpeg",
        data: Buffer.from(bytes).toString("base64"),
      },
    };
    alvo = "desta imagem";
  }

  const inicio = Date.now();
  const r = await new Anthropic().messages.create({
    model: MODELO_LEITURA,
    // ~10 páginas por chamada (LOTE_CLAUDE); acima de ~21 mil o SDK exige streaming.
    max_tokens: 16000,
    // Transcrição não precisa de raciocínio longo.
    output_config: { effort: "low" },
    messages: [
      { role: "user", content: [bloco, { type: "text", text: PROMPT.replace("{alvo}", alvo) }] },
    ],
  });
  if (r.stop_reason === "refusal")
    throw new ErroLeitura("A leitura por IA recusou este documento. Confira o arquivo.");
  if (r.stop_reason === "max_tokens")
    throw new ErroLeitura("Página com texto longo demais para a leitura por IA.");
  const texto = r.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
  const partes = paginas.length > 1 ? texto.split(SEPARADOR).map((p) => p.trim()) : [texto.trim()];
  // Se o modelo não separou certo, junta tudo na primeira página (o texto não se perde).
  const porPagina =
    partes.length === paginas.length
      ? partes
      : [partes.join("\n\n"), ...paginas.slice(1).map(() => "")];
  const tokensEntrada = r.usage.input_tokens;
  const tokensSaida = r.usage.output_tokens;
  return {
    paginas: porPagina,
    uso: {
      modelo: MODELO_LEITURA,
      tokensEntrada,
      tokensSaida,
      custoUsd: (tokensEntrada * PRECO.entrada + tokensSaida * PRECO.saida) / 1e6,
      latenciaMs: Date.now() - inicio,
    },
  };
}
