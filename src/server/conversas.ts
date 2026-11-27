/** Consultas das conversas usadas por `src/lib/conversas.functions.ts` (só no servidor). */
import { desc, eq, sql } from "drizzle-orm";
import type { MensagemConversa } from "@/lib/conversas.functions";
import { schema as s, type Tx } from "@/server/db";

/**
 * Caixa de /app/agente (#100): Crítica → Alta → Normal (a maior entre a conversa e as demandas
 * abertas, como `maiorPrioridade`), a mais recente primeiro em cada nível, resolvidas no fim.
 * A ordem fica no SQL para o limite não cortar uma Crítica antiga.
 */
export async function caixaDeConversas(tx: Tx) {
  const c = s.conversas;
  // Enum prioridade: normal < alta < critica.
  const prioDemandas = sql`(select max(d.prioridade) from demandas d
    where d.conversa_id = ${c.id} and d.coluna <> 'resolvidas')`;
  return (
    tx
      .select({
        conversa: c,
        morador: s.moradores,
        unidade: s.unidades,
        condominio: s.condominios.nome,
        ultima: sql<{
          texto: string | null;
          tipo: MensagemConversa["tipo"];
          assunto: string | null;
        } | null>`(
            select json_build_object('texto', m.texto, 'tipo', m.tipo, 'assunto', m.assunto)
            from mensagens m
            where m.conversa_id = ${c.id} order by m.criado_em desc limit 1)`,
        prioridades: sql<("normal" | "alta" | "critica")[] | null>`(
            select array_agg(d.prioridade::text) from demandas d
            where d.conversa_id = ${c.id} and d.coluna <> 'resolvidas')`,
      })
      .from(c)
      .leftJoin(s.moradores, eq(s.moradores.id, c.moradorId))
      .leftJoin(s.unidades, eq(s.unidades.id, s.moradores.unidadeId))
      .leftJoin(s.condominios, eq(s.condominios.id, c.condominioId))
      .orderBy(
        sql`${c.estado} = 'resolvida'`,
        sql`greatest(${c.prioridade}, ${prioDemandas}) desc`,
        desc(c.ultimaMsgEm),
      )
      // ponytail: as 200 primeiras nessa ordem; paginar quando um cliente passar disso.
      .limit(200)
  );
}
