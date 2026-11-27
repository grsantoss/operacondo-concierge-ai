/** Ferramenta `abrir_demanda`. */
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { PRIO_TELA, proximoCodigoDemanda, SLA_HORAS } from "@/lib/demandas.functions";
import { schema as s } from "@/server/db";
import type { Base } from "./index";

export function abrirDemanda({ ctx, tenantId, condominioId, tx }: Base) {
  return betaZodTool({
    name: "abrir_demanda",
    description:
      "Abre uma demanda para a administração (manutenção, segurança, limpeza, administrativo). Use quando o morador relatar um problema ou pedir um serviço. Abre na hora; avise o código ao morador.",
    inputSchema: z.object({
      titulo: z.string().min(4).max(120),
      descricao: z.string().min(10).max(1200).describe("O que o morador relatou, com detalhes"),
      categoria: z.enum(["manutencao", "seguranca", "limpeza", "administrativo"]),
      prioridade: z
        .enum(["normal", "alta", "critica"])
        .describe("critica: risco a pessoas; alta: dano em andamento; normal: o resto"),
      local: z.string().max(120).optional(),
      custo_estimado: z
        .number()
        .min(0)
        .optional()
        .describe("Só se o morador informou um valor ou orçamento"),
    }),
    run: async (d) =>
      tx(async (t) => {
        const [m] = ctx.conversa.moradorId
          ? await t
              .select({ unidadeId: s.moradores.unidadeId })
              .from(s.moradores)
              .where(eq(s.moradores.id, ctx.conversa.moradorId))
          : [];
        const limite = ctx.config.limiteAprovacao;
        const acimaLimite = d.custo_estimado != null && limite != null && d.custo_estimado > limite;
        const codigo = await proximoCodigoDemanda(t);
        const [nova] = await t
          .insert(s.demandas)
          .values({
            tenantId,
            codigo,
            condominioId,
            moradorId: ctx.conversa.moradorId,
            unidadeId: m?.unidadeId ?? null,
            conversaId: ctx.conversa.id,
            titulo: d.titulo,
            descricao: d.descricao,
            local: d.local,
            categoria: d.categoria,
            prioridade: d.prioridade,
            // Acima do limite de aprovação: vai para análise do síndico, não para execução.
            coluna: acimaLimite ? "triagem" : "novas",
            slaAte: new Date(Date.now() + SLA_HORAS[PRIO_TELA[d.prioridade]] * 3_600_000),
            custoEstimado: d.custo_estimado ?? null,
          })
          .returning({ id: s.demandas.id });
        await t.insert(s.demandaEventos).values([
          {
            tenantId,
            demandaId: nova!.id,
            ator: "Concierge IA",
            acao: "Abriu a demanda pelo WhatsApp",
            canal: "ia",
          },
          ...(acimaLimite
            ? [
                {
                  tenantId,
                  demandaId: nova!.id,
                  ator: "Concierge IA",
                  acao: "Aguarda aprovação do síndico",
                  detalhe: `Custo estimado acima do limite de aprovação (R$ ${limite}).`,
                  canal: "ia" as const,
                },
              ]
            : []),
        ]);
        return `Demanda ${codigo} aberta${acimaLimite ? " e enviada para aprovação do síndico (valor acima do limite)" : ""}.`;
      }),
  });
}
