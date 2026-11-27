/** Ferramenta `identificar_morador`. */
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { schema as s } from "@/server/db";
import type { Base } from "./index";

export function identificarMorador({ ctx, email, tx }: Base) {
  return betaZodTool({
    name: "identificar_morador",
    description:
      "Mostra quem é o morador desta conversa (nome, unidade, situação do cadastro). Só os dados dele mesmo.",
    inputSchema: z.object({}),
    run: async () => {
      if (!ctx.conversa.moradorId)
        return `${email ? "Remetente" : "Número"} sem cadastro neste condomínio. Se o morador quiser, faça o cadastro com registrar_cadastro.`;
      const [m] = await tx((t) =>
        t
          .select({ m: s.moradores, u: s.unidades })
          .from(s.moradores)
          .leftJoin(s.unidades, eq(s.unidades.id, s.moradores.unidadeId))
          .where(eq(s.moradores.id, ctx.conversa.moradorId!)),
      );
      if (!m) return "Cadastro não encontrado.";
      const u = m.u;
      const unidade = u
        ? [
            u.bloco && `Bloco ${u.bloco}`,
            u.apto && `Apto ${u.apto}`,
            u.quadra && `Quadra ${u.quadra}`,
            u.casa && `Casa ${u.casa}`,
          ]
            .filter(Boolean)
            .join(", ")
        : (m.m.unidadeInformada ?? "não informada");
      return `Nome: ${m.m.nome}. Unidade: ${unidade}. Cadastro: ${m.m.cadastro}${m.m.cadastro === "pendente" ? " (aguarda aprovação do síndico)" : ""}.`;
    },
  });
}
