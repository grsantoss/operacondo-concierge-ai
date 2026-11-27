/** Ferramenta `minhas_demandas`. */
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { schema as s } from "@/server/db";
import type { Base } from "./index";

const COLUNA_TEXTO = {
  novas: "recebida",
  triagem: "em análise",
  execucao: "em execução",
  resolvidas: "resolvida",
} as const;

export function minhasDemandas({ ctx, aprovado, tx }: Base) {
  return betaZodTool({
    name: "minhas_demandas",
    description:
      "Lista as demandas do próprio morador (abertas e as 5 últimas resolvidas). Só para cadastro aprovado.",
    inputSchema: z.object({}),
    run: async () => {
      if (!aprovado || !ctx.conversa.moradorId)
        return "Só moradores com cadastro aprovado podem consultar as próprias demandas.";
      const ds = await tx((t) =>
        t
          .select()
          .from(s.demandas)
          .where(eq(s.demandas.moradorId, ctx.conversa.moradorId!))
          .orderBy(desc(s.demandas.atualizadoEm))
          .limit(15),
      );
      const abertas = ds.filter((x) => x.coluna !== "resolvidas");
      const lista = [...abertas, ...ds.filter((x) => x.coluna === "resolvidas").slice(0, 5)];
      if (!lista.length) return "O morador não tem demandas.";
      return lista.map((x) => `${x.codigo}: ${x.titulo} (${COLUNA_TEXTO[x.coluna]})`).join("\n");
    },
  });
}
