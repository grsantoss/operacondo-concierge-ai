/** Processa as mensagens agrupadas de uma conversa (job da fila "mensagem"). */
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { dbAdmin, schema as s } from "@/server/db";
import type { JobMensagem } from "@/server/queue";

/** Trava as entradas pendentes da conversa, entrega a `fn` e marca como processadas. */
export async function processarConversa(
  job: JobMensagem,
  fn: (entradas: (typeof s.whatsappEntradas.$inferSelect)[]) => Promise<void> = async () => {},
): Promise<number> {
  return dbAdmin().transaction(async (tx) => {
    const e = s.whatsappEntradas;
    const entradas = await tx
      .select()
      .from(e)
      .where(and(eq(e.canalId, job.canalId), eq(e.telefone, job.telefone), isNull(e.processadoEm)))
      .orderBy(asc(e.recebidoEm))
      .for("update", { skipLocked: true });
    if (!entradas.length) return 0;
    // Se `fn` falhar, nada é marcado e a fila tenta de novo (mensagens não duplicam).
    await fn(entradas);
    await tx
      .update(e)
      .set({ processadoEm: new Date() })
      .where(
        inArray(
          e.id,
          entradas.map((x) => x.id),
        ),
      );
    return entradas.length;
  });
}
