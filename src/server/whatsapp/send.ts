/** Envia texto ao morador pela Z-API e grava a mensagem de saída na conversa. */
import { eq } from "drizzle-orm";
import { schema as s, type Tx } from "@/server/db";
import { credDoCanal, enviarTextoZapi } from "@/server/whatsapp/zapi";

export async function enviarNaConversa(
  tx: Tx,
  conversa: { id: string; tenantId: string; canalId: string; phoneE164: string },
  texto: string,
  autor: "sistema" | "sindico" | "ia",
  avaliacaoRascunho?: "aprovado" | "editado" | "reescrito",
) {
  const [canal] = await tx
    .select()
    .from(s.whatsappCanais)
    .where(eq(s.whatsappCanais.id, conversa.canalId));
  if (!canal) throw new Error("Canal da conversa não encontrado.");
  const providerMsgId = await enviarTextoZapi(credDoCanal(canal), conversa.phoneE164, texto);
  await tx.insert(s.mensagens).values({
    tenantId: conversa.tenantId,
    conversaId: conversa.id,
    direcao: "saida",
    autor,
    tipo: "texto",
    texto,
    providerMsgId,
    avaliacaoRascunho,
  });
}
