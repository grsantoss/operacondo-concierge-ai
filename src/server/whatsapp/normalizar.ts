/** Payload da Z-API ("Ao receber") → tipo, texto e mídia da mensagem gravada em `mensagens`. */
type Tipo = "texto" | "audio" | "imagem" | "documento";

interface Midia {
  /** URL da Z-API (temporária): o worker baixa e guarda no S3. */
  url: string;
  mime: string | null;
}

interface Payload {
  text?: { message?: string };
  image?: { caption?: string; imageUrl?: string; mimeType?: string };
  sticker?: { stickerUrl?: string; mimeType?: string };
  audio?: { audioUrl?: string; mimeType?: string };
  video?: { caption?: string; videoUrl?: string; mimeType?: string };
  document?: { fileName?: string; title?: string; documentUrl?: string; mimeType?: string };
  location?: { address?: string; latitude?: number; longitude?: number };
}

export interface Normalizada {
  tipo: Tipo;
  texto: string | null;
  midia: Midia | null;
}

const midia = (url?: string, mime?: string): Midia | null =>
  url ? { url, mime: mime ?? null } : null;

export function normalizarZapi(p: Payload): Normalizada {
  if (p.text) return { tipo: "texto", texto: p.text.message?.trim() || null, midia: null };
  if (p.image)
    return {
      tipo: "imagem",
      texto: p.image.caption?.trim() || null,
      midia: midia(p.image.imageUrl, p.image.mimeType),
    };
  if (p.sticker)
    return {
      tipo: "imagem",
      texto: "[figurinha]",
      midia: midia(p.sticker.stickerUrl, p.sticker.mimeType),
    };
  if (p.audio)
    return { tipo: "audio", texto: null, midia: midia(p.audio.audioUrl, p.audio.mimeType) };
  if (p.video)
    return {
      tipo: "documento",
      texto: p.video.caption?.trim() || "[vídeo]",
      midia: midia(p.video.videoUrl, p.video.mimeType),
    };
  if (p.document)
    return {
      tipo: "documento",
      texto: p.document.fileName ?? p.document.title ?? "[documento]",
      midia: midia(p.document.documentUrl, p.document.mimeType),
    };
  if (p.location) {
    const l = p.location;
    return {
      tipo: "texto",
      texto: `📍 ${l.address || `${l.latitude}, ${l.longitude}`}`,
      midia: null,
    };
  }
  return { tipo: "texto", texto: "[mensagem de um tipo ainda não suportado]", midia: null };
}
