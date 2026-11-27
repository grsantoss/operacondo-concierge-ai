/** Ferramenta `definir_condominio`. */
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { schema as s } from "@/server/db";
import { escolherCondominio } from "@/server/pipeline/roteamento";
import type { Base } from "./index";

export function definirCondominio({ ctx, efeitos, condominioId, telefone, tx }: Base) {
  return betaZodTool({
    name: "definir_condominio",
    description:
      "Troca o condomínio da conversa quando o morador disser que é de outro condomínio da mesma administração. Depois da troca, a conversa recomeça com os documentos do novo condomínio.",
    inputSchema: z.object({
      condominio: z.string().min(2).max(120).describe("Nome ou número da lista"),
    }),
    run: async ({ condominio }) =>
      tx(async (t) => {
        // Opções: os condomínios deste telefone; número sem cadastro → todos do cliente. No
        // e-mail, sempre todos e sem morador: a identificação pelo remetente exige DKIM/DMARC,
        // conferidos só na entrada.
        const meus = !telefone
          ? []
          : await t
              .select({
                condominioId: s.condominios.id,
                nome: s.condominios.nome,
                moradorId: s.moradorContatos.moradorId,
              })
              .from(s.moradorContatos)
              .innerJoin(s.condominios, eq(s.condominios.id, s.moradorContatos.condominioId))
              .where(eq(s.moradorContatos.phoneE164, telefone));
        const opcoes = meus.length
          ? meus
          : (
              await t
                .select({ condominioId: s.condominios.id, nome: s.condominios.nome })
                .from(s.condominios)
            ).map((c) => ({ ...c, moradorId: null as string | null }));
        const achou = escolherCondominio(condominio, opcoes);
        if (!achou)
          return `Não encontrei esse condomínio. Opções: ${opcoes.map((o) => o.nome).join("; ")}.`;
        if (achou.condominioId === condominioId) return `A conversa já é do ${achou.nome}.`;
        await t
          .update(s.conversas)
          .set({ condominioId: achou.condominioId, moradorId: achou.moradorId })
          .where(eq(s.conversas.id, ctx.conversa.id));
        efeitos.trocouCondominio = true;
        return `Condomínio trocado para ${achou.nome}. Não responda mais nada agora: a conversa recomeça com os documentos dele.`;
      }),
  });
}
