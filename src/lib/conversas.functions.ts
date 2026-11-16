/**
 * Conversas do WhatsApp para /app/agente: lista, mensagens e ações do síndico
 * (responder, assumir, resolver). O envio usa src/server/whatsapp/send.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Priority } from "@/data/demandas";
import { PRIO_TELA, unidadeTexto } from "@/lib/demandas.functions";
import { formatarTelefone } from "@/lib/telefone";
import { maiorPrioridade } from "@/lib/urgencia";
import { exigirCliente } from "@/server/auth/contexto";
import { schema as s, withTenant } from "@/server/db";
import { enviarNaConversa } from "@/server/whatsapp/send";
import { ErroZapi } from "@/server/whatsapp/zapi";

export type EstadoConversa = "ia" | "aguardando_sindico" | "sindico" | "resolvida";

export interface ConversaResumo {
  id: string;
  /** Nome do morador ou, se desconhecido, o telefone. */
  nome: string;
  telefone: string;
  conhecido: boolean;
  /** Cadastro do morador (pendente = aguarda aprovação do síndico). */
  cadastro: "pendente" | "aprovado" | "recusado" | null;
  unidade: string | null;
  condominio: string | null;
  condominioId: string | null;
  moradorId: string | null;
  estado: EstadoConversa;
  urgencia: Priority;
  preview: string;
  ultimaMsgEm: string;
}

export interface MensagemConversa {
  id: string;
  direcao: "entrada" | "saida";
  autor: "morador" | "ia" | "sindico" | "sistema";
  tipo: "texto" | "audio" | "imagem" | "documento";
  texto: string | null;
  criadoEm: string;
}

const ROTULO_TIPO = { texto: "", audio: "[áudio]", imagem: "[imagem]", documento: "[documento]" };

async function exigirGestor() {
  const c = await exigirCliente();
  if (c.papel === "conselho") throw new Error("O conselho só acompanha as conversas.");
  return c;
}

export const listarConversas = createServerFn({ method: "GET" }).handler(
  async (): Promise<ConversaResumo[]> => {
    const { tenantId } = await exigirCliente();
    return withTenant(tenantId, async (tx) => {
      const c = s.conversas;
      const linhas = await tx
        .select({
          conversa: c,
          morador: s.moradores,
          unidade: s.unidades,
          condominio: s.condominios.nome,
          ultima: sql<{ texto: string | null; tipo: MensagemConversa["tipo"] } | null>`(
            select json_build_object('texto', m.texto, 'tipo', m.tipo) from mensagens m
            where m.conversa_id = ${c.id} order by m.criado_em desc limit 1)`,
          prioridades: sql<("normal" | "alta" | "critica")[] | null>`(
            select array_agg(d.prioridade) from demandas d
            where d.conversa_id = ${c.id} and d.coluna <> 'resolvidas')`,
        })
        .from(c)
        .leftJoin(s.moradores, eq(s.moradores.id, c.moradorId))
        .leftJoin(s.unidades, eq(s.unidades.id, s.moradores.unidadeId))
        .leftJoin(s.condominios, eq(s.condominios.id, c.condominioId))
        .orderBy(desc(c.ultimaMsgEm))
        // ponytail: as 200 mais recentes; paginar quando um cliente passar disso.
        .limit(200);
      return linhas.map(({ conversa: cv, morador, unidade, condominio, ultima, prioridades }) => ({
        id: cv.id,
        nome: morador?.nome ?? formatarTelefone(cv.phoneE164),
        telefone: formatarTelefone(cv.phoneE164),
        conhecido: !!morador,
        cadastro: morador?.cadastro ?? null,
        unidade: morador?.unidadeId ? unidadeTexto(unidade) : null,
        condominio,
        condominioId: cv.condominioId,
        moradorId: cv.moradorId,
        estado: cv.estado,
        urgencia: maiorPrioridade(
          PRIO_TELA[cv.prioridade],
          ...(prioridades ?? []).map((p) => PRIO_TELA[p]),
        ),
        preview: ultima ? ultima.texto || ROTULO_TIPO[ultima.tipo] : "",
        ultimaMsgEm: cv.ultimaMsgEm.toISOString(),
      }));
    });
  },
);

const porId = z.object({ id: z.string().uuid() });

export const listarMensagens = createServerFn({ method: "GET" })
  .inputValidator(porId)
  .handler(async ({ data }): Promise<MensagemConversa[]> => {
    const { tenantId } = await exigirCliente();
    const linhas = await withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(s.mensagens)
        .where(eq(s.mensagens.conversaId, data.id))
        .orderBy(asc(s.mensagens.criadoEm))
        // ponytail: últimas 500 bastam para a tela; histórico completo quando pedirem.
        .limit(500),
    );
    return linhas.map((m) => ({
      id: m.id,
      direcao: m.direcao,
      autor: m.autor,
      tipo: m.tipo,
      texto: m.texto ?? (ROTULO_TIPO[m.tipo] || null),
      criadoEm: m.criadoEm.toISOString(),
    }));
  });

async function mudarEstado(id: string, estado: EstadoConversa) {
  const { tenantId } = await exigirGestor();
  const r = await withTenant(tenantId, (tx) =>
    tx
      .update(s.conversas)
      .set({ estado })
      .where(eq(s.conversas.id, id))
      .returning({ id: s.conversas.id }),
  );
  if (!r.length) throw new Error("Conversa não encontrada.");
}

/** Síndico assume: a IA (quando existir) para de responder nesta conversa. */
export const assumirConversa = createServerFn({ method: "POST" })
  .inputValidator(porId)
  .handler(({ data }) => mudarEstado(data.id, "sindico"));

export const resolverConversa = createServerFn({ method: "POST" })
  .inputValidator(porId)
  .handler(({ data }) => mudarEstado(data.id, "resolvida"));

/** Resposta do síndico: vai pelo WhatsApp e a conversa fica com ele. */
export const responderConversa = createServerFn({ method: "POST" })
  .inputValidator(
    porId.extend({ texto: z.string().trim().min(1, "Escreva a mensagem.").max(4000) }),
  )
  .handler(async ({ data }) => {
    const { tenantId } = await exigirGestor();
    try {
      await withTenant(tenantId, async (tx) => {
        const [cv] = await tx
          .select()
          .from(s.conversas)
          .where(eq(s.conversas.id, data.id))
          .limit(1);
        if (!cv) throw new Error("Conversa não encontrada.");
        await enviarNaConversa(tx, cv, data.texto, "sindico");
        await tx
          .update(s.conversas)
          .set({ estado: "sindico", ultimaMsgEm: sql`now()` })
          .where(eq(s.conversas.id, cv.id));
      });
    } catch (err) {
      if (err instanceof ErroZapi) throw new Error(`Não foi enviada: ${err.message}`);
      throw err;
    }
  });
