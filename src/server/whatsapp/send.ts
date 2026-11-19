/**
 * Envia texto ao morador pelo canal da conversa e grava a mensagem de saída. WhatsApp pela Z-API;
 * e-mail (#81) pela SES, do endereço de atendimento do cliente, na mesma thread. Falha no envio
 * lança o erro: a transação volta e a fila tenta de novo.
 */
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { schema as s, type Tx } from "@/server/db";
import { assuntoResposta, enviarRespostaEmail } from "@/server/email";
import { credDoCanal, enviarTextoZapi } from "@/server/whatsapp/zapi";

export interface ConversaEnvio {
  id: string;
  tenantId: string;
  canal: "whatsapp" | "email";
  canalId: string | null;
  emailCanalId?: string | null;
  condominioId?: string | null;
  endereco: string;
}

export async function enviarNaConversa(
  tx: Tx,
  conversa: ConversaEnvio,
  texto: string,
  autor: "sistema" | "sindico" | "ia",
  avaliacaoRascunho?: "aprovado" | "editado" | "reescrito",
) {
  const saida = { tenantId: conversa.tenantId, conversaId: conversa.id, direcao: "saida" as const };
  if (conversa.canal === "email") {
    await tx.insert(s.mensagens).values({
      ...saida,
      autor,
      tipo: "texto",
      texto,
      avaliacaoRascunho,
      ...(await enviarEmailNaConversa(tx, conversa, texto)),
    });
    return;
  }
  if (!conversa.canalId) throw new Error("Canal da conversa não encontrado.");
  const [canal] = await tx
    .select()
    .from(s.whatsappCanais)
    .where(eq(s.whatsappCanais.id, conversa.canalId));
  if (!canal) throw new Error("Canal da conversa não encontrado.");
  const providerMsgId = await enviarTextoZapi(credDoCanal(canal), conversa.endereco, texto);
  await tx.insert(s.mensagens).values({
    ...saida,
    autor,
    tipo: "texto",
    texto,
    providerMsgId,
    avaliacaoRascunho,
  });
}

/** Responde ao último e-mail do morador (In-Reply-To) com toda a thread em References. */
async function enviarEmailNaConversa(tx: Tx, conversa: ConversaEnvio, texto: string) {
  const [cv] = await tx
    .select({
      canal: s.emailCanais.endereco,
      condominio: s.condominios.nome,
      cliente: s.tenants.nomeFantasia,
    })
    .from(s.conversas)
    .innerJoin(s.emailCanais, eq(s.emailCanais.id, s.conversas.emailCanalId))
    .innerJoin(s.tenants, eq(s.tenants.id, s.conversas.tenantId))
    .leftJoin(s.condominios, eq(s.condominios.id, s.conversas.condominioId))
    .where(eq(s.conversas.id, conversa.id));
  if (!cv) throw new Error("Canal de e-mail da conversa não encontrado.");
  const thread = await tx
    .select({
      messageId: s.mensagens.messageId,
      assunto: s.mensagens.assunto,
      direcao: s.mensagens.direcao,
    })
    .from(s.mensagens)
    .where(and(eq(s.mensagens.conversaId, conversa.id), isNotNull(s.mensagens.messageId)))
    .orderBy(asc(s.mensagens.criadoEm));
  const ultima = thread.filter((m) => m.direcao === "entrada").at(-1);
  const assunto = assuntoResposta(thread.filter((m) => m.assunto).at(-1)?.assunto ?? null);
  const { messageId, sesId } = await enviarRespostaEmail({
    de: cv.canal,
    nome: cv.condominio ?? cv.cliente,
    para: conversa.endereco,
    assunto,
    texto,
    inReplyTo: ultima?.messageId ?? null,
    references: thread.map((m) => m.messageId!),
  });
  return { messageId, assunto, inReplyTo: ultima?.messageId ?? null, providerMsgId: sesId };
}
