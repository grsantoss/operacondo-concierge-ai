/** Payload da Z-API ("Ao receber") → tipo e texto da mensagem gravada em `mensagens`. */
type Tipo = "texto" | "audio" | "imagem" | "documento";

interface Payload {
  text?: { message?: string };
  image?: { caption?: string };
  sticker?: unknown;
  audio?: unknown;
  video?: { caption?: string };
  document?: { fileName?: string; title?: string };
  location?: { address?: string; latitude?: number; longitude?: number };
}

// ponytail: mídia ainda sem arquivo (a URL da Z-API expira); download para o S3 e transcrição na #20.
export function normalizarZapi(p: Payload): { tipo: Tipo; texto: string | null } {
  if (p.text) return { tipo: "texto", texto: p.text.message?.trim() || null };
  if (p.image) return { tipo: "imagem", texto: p.image.caption?.trim() || null };
  if (p.sticker) return { tipo: "imagem", texto: "[figurinha]" };
  if (p.audio) return { tipo: "audio", texto: null };
  if (p.video) return { tipo: "documento", texto: p.video.caption?.trim() || "[vídeo]" };
  if (p.document)
    return { tipo: "documento", texto: p.document.fileName ?? p.document.title ?? "[documento]" };
  if (p.location) {
    const l = p.location;
    return { tipo: "texto", texto: `📍 ${l.address || `${l.latitude}, ${l.longitude}`}` };
  }
  return { tipo: "texto", texto: "[mensagem de um tipo ainda não suportado]" };
}
