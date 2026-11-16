/**
 * Corta o texto (Markdown do Docling ou do Claude) em trechos citáveis.
 * Convenção, estatuto e regimento: um trecho por artigo ou cláusula, com os parágrafos e incisos
 * dentro. Sem artigos (atas, comunicados): por título; seção grande é cortada por tamanho.
 */
export interface Trecho {
  /** Ex.: "Art. 12", "Cláusula Terceira", "Capítulo II" ou o título da seção. */
  referencia: string | null;
  texto: string;
}

// "Art. 12", "Art 12º", "Artigo 12", "ARTIGO 3.º" — com ou sem negrito/título Markdown.
const ARTIGO = /^\s*(?:#+\s*)?[*_]*\s*(art(?:igo)?\.?\s*(\d+)\s*(?:[º°o]|\.º)?)/i;
// "Cláusula Primeira", "CLÁUSULA 3ª".
const CLAUSULA = /^\s*(?:#+\s*)?[*_]*\s*(cl[áa]usula\s+(\d+\s*[ªa]?|[a-zçãéêíóôú]+))/i;
// Capítulo/Título/Seção só dão contexto: não abrem trecho quando há artigos.
const SECAO = /^\s*(?:#+\s*)?[*_]*\s*((cap[íi]tulo|t[íi]tulo|se[çc][ãa]o)\s+[ivxlcdm\d]+)\b/i;
const TITULO_MD = /^\s*#{1,6}\s+(.+?)\s*#*\s*$/;

/** Acima disso o trecho é dividido (por parágrafo), para caber bem no contexto do agente. */
const MAX = 3000;
const ALVO = 1500;

function limpar(s: string) {
  return s.replace(/[*_]+/g, "").replace(/\s+/g, " ").trim();
}

function referenciaArtigo(linha: string): string | null {
  const a = linha.match(ARTIGO);
  if (a) return `Art. ${a[2]}`;
  const c = linha.match(CLAUSULA);
  if (c) {
    const n = limpar(c[2]!);
    return `Cláusula ${n.charAt(0).toUpperCase()}${n.slice(1).toLowerCase()}`;
  }
  return null;
}

/** Divide texto longo em pedaços de ~ALVO caracteres, sem quebrar parágrafos. */
function dividir(texto: string): string[] {
  if (texto.length <= MAX) return [texto];
  const partes: string[] = [];
  let atual = "";
  for (const p of texto.split(/\n{2,}/)) {
    if (atual && atual.length + p.length > ALVO) {
      partes.push(atual.trim());
      atual = "";
    }
    atual += `${p}\n\n`;
  }
  if (atual.trim()) partes.push(atual.trim());
  // ponytail: parágrafo único gigante (OCR sem quebras) fica inteiro; cortar por frase se aparecer.
  return partes;
}

// OCR/Docling às vezes junta artigos no mesmo parágrafo ("... vaga. Art. 4º É proibido ...").
// Só quebra depois de fim de frase: "conforme o Art. 5º" no meio do texto fica intacto.
const ARTIGO_COLADO =
  /([.;:])[ \t]+(?=(?:art(?:igo)?\.?\s*\d+\s*(?:[º°o]|\.º)?|cl[áa]usula\s+\S+)[\s.–-])/gi;

export function cortarTrechos(md: string): Trecho[] {
  const linhas = md.replace(/\r\n/g, "\n").replace(ARTIGO_COLADO, "$1\n\n").split("\n");
  const porArtigo = linhas.filter((l) => referenciaArtigo(l)).length >= 2;
  const blocos: { referencia: string | null; linhas: string[] }[] = [];
  let atual: { referencia: string | null; linhas: string[] } = { referencia: null, linhas: [] };
  let secao: string | null = null;
  let nomeSecaoPendente = false;

  for (const linha of linhas) {
    const ref = porArtigo ? referenciaArtigo(linha) : null;
    const sec = linha.match(SECAO);
    const titulo = !porArtigo ? linha.match(TITULO_MD) : null;
    if (ref) {
      nomeSecaoPendente = false;
      blocos.push(atual);
      // O capítulo vira contexto do artigo (ajuda a busca e a citação).
      atual = { referencia: ref, linhas: secao ? [`(${secao})`, linha] : [linha] };
      continue;
    }
    if (porArtigo && sec) {
      // "CAPÍTULO II – DAS ÁREAS COMUNS" (o nome pode vir na linha seguinte).
      secao = limpar(linha.replace(/^\s*#+\s*/, ""));
      nomeSecaoPendente = secao.length <= limpar(sec[1]!).length + 2;
      continue;
    }
    if (porArtigo && nomeSecaoPendente && linha.trim()) {
      secao = `${secao} – ${limpar(linha.replace(/^\s*#+\s*/, ""))}`;
      nomeSecaoPendente = false;
      continue;
    }
    if (titulo) {
      blocos.push(atual);
      atual = { referencia: limpar(titulo[1]!).slice(0, 120), linhas: [linha] };
      continue;
    }
    atual.linhas.push(linha);
  }
  blocos.push(atual);

  const trechos: Trecho[] = [];
  for (const b of blocos) {
    const texto = b.linhas.join("\n").trim();
    // Linha solta de capítulo, só o marcador, sem conteúdo: não vira trecho.
    if (!texto || texto.replace(/[\W_]+/g, "").length < 3) continue;
    const ref = b.referencia ?? (trechos.length ? null : porArtigo ? "Preâmbulo" : null);
    const partes = dividir(texto);
    partes.forEach((p, i) =>
      trechos.push({
        referencia: ref && partes.length > 1 ? `${ref} (parte ${i + 1})` : ref,
        texto: p,
      }),
    );
  }
  return trechos;
}
