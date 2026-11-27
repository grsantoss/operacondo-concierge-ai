/** Ferramenta `buscar_regras`. */
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaToolResultContentBlockParam } from "@anthropic-ai/sdk/resources/beta";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { mascararCpf } from "@/lib/mascarar";
import { COLECAO_NOME } from "@/server/agent/contexto";
import { schema as s } from "@/server/db";
import type { Base } from "./index";

export function buscarRegras({ condominioId, visiveis, tx }: Base) {
  return betaZodTool({
    name: "buscar_regras",
    description:
      "Busca trechos nos documentos do condomínio (convenção, estatuto, regimento, atas, comunicados). Use quando a resposta não estiver nos documentos já enviados, por exemplo decisões de atas antigas. Devolve trechos citáveis.",
    inputSchema: z.object({
      consulta: z
        .string()
        .min(2)
        .max(200)
        .describe("Palavras-chave em português, ex.: 'mudança horário elevador'"),
    }),
    run: async ({ consulta }) => {
      const linhas = await tx((t) =>
        t
          .select({
            id: s.documentoTrechos.id,
            texto: s.documentoTrechos.texto,
            referencia: s.documentoTrechos.referencia,
            titulo: s.documentos.titulo,
            colecao: s.documentos.colecao,
          })
          .from(s.documentoTrechos)
          .innerJoin(s.documentos, eq(s.documentos.id, s.documentoTrechos.documentoId))
          .where(
            and(
              eq(s.documentoTrechos.condominioId, condominioId),
              inArray(s.documentos.visibilidade, visiveis),
              inArray(s.documentos.status, ["treinado", "revisao"]),
              sql`${s.documentoTrechos.tsv} @@ websearch_to_tsquery('portuguese', ${consulta})`,
            ),
          )
          .orderBy(
            desc(
              sql`ts_rank(${s.documentoTrechos.tsv}, websearch_to_tsquery('portuguese', ${consulta}))`,
            ),
          )
          .limit(6),
      );
      if (!linhas.length) return "Nenhum trecho encontrado para essa busca.";
      return linhas.map(
        (l): BetaToolResultContentBlockParam => ({
          type: "search_result",
          source: `trecho:${l.id}`,
          title: [l.colecao === "ata" ? l.titulo : COLECAO_NOME[l.colecao], l.referencia]
            .filter((x) => x && x !== "Preâmbulo")
            .join(", "),
          content: [{ type: "text", text: mascararCpf(l.texto) }],
          citations: { enabled: true },
        }),
      );
    },
  });
}
