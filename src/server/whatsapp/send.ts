/** Envia texto ao morador pelo canal da conversa e grava a mensagem de saída. */
import { eq } from "drizzle-orm";
import { schema as s, type Tx } from "@/server/db";
import { credDoCanal, enviarTextoZapi } from "@/server/whatsapp/zapi";

export async function enviarNaConversa(
  tx: Tx,
  conversa: {
    id: string;
    tenantId: string;
    canal: "whatsapp" | "email";
    canalId: string | null;
    endereco: string;
  },
  texto: string,
  autor: "sistema" | "sindico" | "ia",
  avaliacaoRascunho?: "aprovado" | "editado" | "reescrito",
) {
  // ponytail: envio por e-mail entra na #81.
  if (conversa.canal !== "whatsapp" || !conversa.canalId)
    throw new Error("Envio por e-mail ainda não disponível.");
  const [canal] = await tx
    .select()
    .from(s.whatsappCanais)
    .where(eq(s.whatsappCanais.id, conversa.canalId));
  if (!canal) throw new Error("Canal da conversa não encontrado.");
  const providerMsgId = await enviarTextoZapi(credDoCanal(canal), conversa.endereco, texto);
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
