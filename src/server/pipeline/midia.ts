/**
 * Job da fila "midia": baixa o arquivo da Z-API, guarda no S3 e, se for áudio, transcreve.
 * O texto transcrito passa pelas regras fixas de urgência, como uma mensagem escrita.
 * Fotos ficam guardadas para o agente ler (Fase 3).
 */
import { eq } from "drizzle-orm";
import { gravarArquivo } from "@/server/arquivos";
import { schema as s, withTenant } from "@/server/db";
import { subirUrgencia } from "@/server/pipeline/roteamento";
import { detectarUrgencia } from "@/server/pipeline/regras-urgencia";
import type { JobAlerta, JobMidia } from "@/server/queue";
import { transcrever } from "@/server/whatsapp/transcricao";

/** WhatsApp limita mídia a 16 MB (documento vai além); acima disso não guardamos. */
const LIMITE_BYTES = 20 * 1024 * 1024;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
};

export function extensao(mime: string, url: string): string {
  const base = mime.split(";")[0]!.trim().toLowerCase();
  if (EXT[base]) return EXT[base]!;
  const daUrl = new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1];
  return daUrl?.toLowerCase() ?? "bin";
}

export async function processarMidia(job: JobMidia): Promise<{ alerta: JobAlerta | null }> {
  // A Z-API entrega mídia em https; http só fora de produção (servidor falso nos testes).
  if (process.env.NODE_ENV === "production" && !job.url.startsWith("https://"))
    throw new Error("URL de mídia recusada (só https).");
  const r = await fetch(job.url, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`Download da mídia respondeu ${r.status}.`);
  if (Number(r.headers.get("content-length") ?? 0) > LIMITE_BYTES) return { alerta: null };
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.byteLength > LIMITE_BYTES) return { alerta: null };
  const mime = (job.mime ?? r.headers.get("content-type") ?? "application/octet-stream")
    .split(";")[0]!
    .trim();

  return withTenant(job.tenantId, async (tx) => {
    const [m] = await tx
      .select({ msg: s.mensagens, condominioId: s.conversas.condominioId })
      .from(s.mensagens)
      .innerJoin(s.conversas, eq(s.conversas.id, s.mensagens.conversaId))
      .where(eq(s.mensagens.id, job.mensagemId));
    if (!m) return { alerta: null };
    const caminho = `${job.tenantId}/${m.condominioId ?? "sem-condominio"}/whatsapp/${m.msg.conversaId}/${m.msg.id}.${extensao(mime, job.url)}`;
    await gravarArquivo(caminho, bytes, mime);

    let transcricao: string | null = null;
    if (m.msg.tipo === "audio") {
      try {
        transcricao = await transcrever(bytes, mime);
      } catch (e) {
        // ponytail: falha na transcrição não refaz o download; o áudio fica tocável no painel.
        console.error("[midia] transcrição falhou:", (e as Error).message);
      }
    }
    await tx
      .update(s.mensagens)
      .set({ midiaPath: caminho, ...(transcricao ? { transcricao } : {}) })
      .where(eq(s.mensagens.id, m.msg.id));

    const regra = detectarUrgencia(transcricao);
    if (!regra) return { alerta: null };
    await subirUrgencia(tx, m.msg.conversaId, regra.prioridade);
    return { alerta: { tenantId: job.tenantId, conversaId: m.msg.conversaId, regra: regra.id } };
  });
}
