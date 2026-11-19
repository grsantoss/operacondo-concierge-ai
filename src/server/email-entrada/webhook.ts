/**
 * Entrada de e-mail pela SES (#79): POST /api/email/ses, chamado pelo SNS. Uma regra de
 * recebimento da SES grava o e-mail bruto num bucket S3 e avisa o tópico `SES_ENTRADA_TOPICO`.
 * Confere a assinatura e o tópico, acha o cliente pelo destinatário (`email_canais.endereco`),
 * grava a entrada (deduplicada pelo Message-ID), enfileira e responde 200. Quem lê é o worker.
 */
import { inArray } from "drizzle-orm";
import { dbAdmin, schema as s } from "@/server/db";
import {
  assinaturaValida,
  buscarCertificado,
  urlDoSns,
  type MensagemSns,
} from "@/server/email-entrada/sns";
import { enfileirarEmail } from "@/server/queue";

/** Campos usados do aviso "Received" da SES (o resto vai para `payload`). */
interface AvisoSes {
  notificationType?: string;
  mail?: { messageId?: string; commonHeaders?: { messageId?: string } };
  receipt?: {
    recipients?: string[];
    action?: { type?: string; bucketName?: string; objectKey?: string };
    spfVerdict?: { status?: string };
    dkimVerdict?: { status?: string };
    dmarcVerdict?: { status?: string };
    spamVerdict?: { status?: string };
    virusVerdict?: { status?: string };
  };
}

const LIMITE_BYTES = 256 * 1024;
const ok = (motivo?: string) =>
  Response.json({ ok: true, ...(motivo ? { ignorado: motivo } : {}) });

export async function receberWebhookSes(
  req: Request,
  buscar: (url: string) => Promise<string> = buscarCertificado,
): Promise<Response> {
  const topico = process.env.SES_ENTRADA_TOPICO;
  if (!topico) return new Response("Recebimento de e-mail não configurado", { status: 503 });
  const corpo = await req.text();
  if (corpo.length > LIMITE_BYTES) return new Response("Payload grande demais", { status: 413 });
  let m: MensagemSns;
  try {
    m = JSON.parse(corpo) as MensagemSns;
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }
  if (m?.TopicArn !== topico) return new Response("Tópico não confere", { status: 403 });
  if (!(await assinaturaValida(m, buscar)))
    return new Response("Assinatura inválida", { status: 403 });

  // Inscrição do endpoint no tópico: confirma visitando a URL da própria AWS.
  if (m.Type === "SubscriptionConfirmation") {
    if (!urlDoSns(m.SubscribeURL))
      return new Response("URL de inscrição inválida", { status: 400 });
    const r = await fetch(m.SubscribeURL!, { signal: AbortSignal.timeout(10_000) });
    return r.ok ? ok() : new Response("Falha ao confirmar a inscrição", { status: 502 });
  }
  if (m.Type !== "Notification") return ok("tipo");

  let aviso: AvisoSes;
  try {
    aviso = JSON.parse(m.Message) as AvisoSes;
  } catch {
    return ok("aviso ilegível");
  }
  if (aviso.notificationType !== "Received") return ok("tipo de aviso");
  const r = aviso.receipt;
  const acao = r?.action;
  if (acao?.type !== "S3" || !acao.bucketName || !acao.objectKey) {
    console.warn("[email] regra da SES sem ação S3: configure a gravação no bucket");
    return ok("sem e-mail no S3");
  }
  const destinatarios = (r?.recipients ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!destinatarios.length) return ok("sem destinatário");
  const canais = await dbAdmin()
    .select({ id: s.emailCanais.id, tenantId: s.emailCanais.tenantId })
    .from(s.emailCanais)
    .where(inArray(s.emailCanais.endereco, destinatarios));
  if (!canais.length) return ok("destinatário desconhecido");

  const messageId = aviso.mail?.commonHeaders?.messageId ?? aviso.mail?.messageId ?? m.MessageId;
  const autenticacao = Object.fromEntries(
    (["spf", "dkim", "dmarc", "spam", "virus"] as const).map((k) => [
      k,
      r?.[`${k}Verdict`]?.status ?? "AUSENTE",
    ]),
  );
  for (const c of canais) {
    const [e] = await dbAdmin()
      .insert(s.emailEntradas)
      .values({
        tenantId: c.tenantId,
        emailCanalId: c.id,
        messageId,
        s3Chave: `${acao.bucketName}/${acao.objectKey}`,
        autenticacao,
        payload: aviso,
      })
      .onConflictDoNothing()
      .returning({ id: s.emailEntradas.id });
    // Reentrega do mesmo e-mail: a entrada já existe e já foi para a fila.
    if (e) await enfileirarEmail({ entradaId: e.id });
  }
  return ok();
}
