/**
 * Webhook "Ao receber" da Z-API: POST /api/whatsapp/zapi/{segredo}.
 * A Z-API não assina as chamadas; a origem é validada pelo segredo da URL (só o hash fica no
 * banco) e pelo instanceId do payload, que precisa ser o do canal. Grava a entrada (deduplicada
 * pelo messageId), enfileira e responde 200 na hora. Quem processa é o worker.
 */
import { eq } from "drizzle-orm";
import { paraE164 } from "@/lib/telefone";
import { hashSegredo } from "@/server/cripto";
import { dbAdmin, schema as s } from "@/server/db";
import { enfileirarMensagem } from "@/server/queue";

/** Campos da Z-API usados aqui (o resto vai inteiro para `payload`). */
interface PayloadZapi {
  type?: string;
  instanceId?: string;
  messageId?: string;
  phone?: string;
  fromMe?: boolean;
  isGroup?: boolean;
  isNewsletter?: boolean;
  broadcast?: boolean;
  isStatusReply?: boolean;
  waitingMessage?: boolean;
}

const LIMITE_BYTES = 256 * 1024;
const ok = (motivo?: string) =>
  Response.json({ ok: true, ...(motivo ? { ignorado: motivo } : {}) });

export async function receberWebhookZapi(segredo: string, req: Request): Promise<Response> {
  if (Number(req.headers.get("content-length") ?? 0) > LIMITE_BYTES)
    return new Response("Payload grande demais", { status: 413 });

  const [canal] = await dbAdmin()
    .select({
      id: s.whatsappCanais.id,
      tenantId: s.whatsappCanais.tenantId,
      instanceId: s.whatsappCanais.instanceId,
    })
    .from(s.whatsappCanais)
    .where(eq(s.whatsappCanais.webhookHash, hashSegredo(segredo)))
    .limit(1);
  // Mesma resposta para segredo errado e canal inexistente: não revela nada.
  if (!canal) return new Response("Não encontrado", { status: 404 });

  let p: PayloadZapi;
  try {
    p = (await req.json()) as PayloadZapi;
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }
  if (!p || typeof p !== "object") return new Response("JSON inválido", { status: 400 });
  if (p.instanceId !== canal.instanceId)
    return new Response("Instância não confere", { status: 403 });

  // Só mensagens de moradores em conversa individual. 200 para a Z-API não reenviar.
  if (p.type !== "ReceivedCallback") return ok("tipo");
  if (p.fromMe) return ok("enviada pelo próprio número");
  if (p.isGroup || p.isNewsletter || p.broadcast || p.isStatusReply)
    return ok("grupo/canal/status");
  if (p.waitingMessage) return ok("mensagem ainda não disponível");
  const telefone = paraE164(p.phone ?? "");
  if (!p.messageId || !telefone) return ok("sem id ou telefone");

  await dbAdmin()
    .insert(s.whatsappEntradas)
    .values({
      tenantId: canal.tenantId,
      canalId: canal.id,
      providerMsgId: p.messageId,
      telefone,
      payload: p,
    })
    .onConflictDoNothing();
  // Enfileira mesmo se a entrada já existia: se o envio anterior falhou, a reentrega da Z-API
  // recupera. Repetido não duplica (um job por conversa; o worker só pega o que não processou).
  await enfileirarMensagem({ tenantId: canal.tenantId, canalId: canal.id, telefone });
  return ok();
}
