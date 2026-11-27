/** Ferramenta `atualizar_demanda`. */
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { schema as s } from "@/server/db";
import type { Base } from "./index";

export function atualizarDemanda({ ctx, tenantId, aprovado, tx }: Base) {
  return betaZodTool({
    name: "atualizar_demanda",
    description:
      "Acrescenta uma informação do morador a uma demanda dele que ainda não foi resolvida. Só para cadastro aprovado.",
    inputSchema: z.object({
      codigo: z
        .string()
        .regex(/^D-\d+$/)
        .describe("Ex.: D-2405"),
      comentario: z.string().min(3).max(1200),
    }),
    run: async ({ codigo, comentario }) => {
      if (!aprovado || !ctx.conversa.moradorId)
        return "Só moradores com cadastro aprovado podem atualizar demandas.";
      return tx(async (t) => {
        const [d] = await t
          .select({ id: s.demandas.id })
          .from(s.demandas)
          .where(
            and(
              eq(s.demandas.codigo, codigo),
              eq(s.demandas.moradorId, ctx.conversa.moradorId!),
              ne(s.demandas.coluna, "resolvidas"),
            ),
          );
        if (!d) return `Não achei a demanda ${codigo} aberta deste morador.`;
        await t.insert(s.demandaEventos).values({
          tenantId,
          demandaId: d.id,
          ator: ctx.morador?.nome ?? "Morador",
          acao: "Comentou pelo WhatsApp",
          detalhe: comentario,
          canal: "whatsapp",
        });
        await t
          .update(s.demandas)
          .set({ atualizadoEm: sql`now()` })
          .where(eq(s.demandas.id, d.id));
        return `Comentário registrado na ${codigo}.`;
      });
    },
  });
}
