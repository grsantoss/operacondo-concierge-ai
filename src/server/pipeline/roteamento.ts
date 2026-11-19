/**
 * Roteamento sem IA: o canal já identifica o cliente; o telefone identifica o condomínio.
 * - 1 condomínio (morador conhecido, ou cliente com um só) → segue;
 * - vários, ou número desconhecido → menu numerado; a resposta (número ou nome) define.
 * Enquanto o condomínio não estiver definido, nada específico de condomínio é respondido.
 * Cadastro pendente do número desconhecido (unidade, nome, LGPD) é outra etapa.
 * Roda dentro de `withTenant` (oc_app, sujeito à RLS).
 */
import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { schema as s, withTenant, type Tx } from "@/server/db";
import { ATENDIMENTO_INDISPONIVEL, suspensaoDo } from "@/server/billing/limites";
import { iaConfigurada } from "@/server/llm";
import type { JobAgente, JobAlerta, JobMensagem, JobMidia } from "@/server/queue";
import { detectarUrgencia } from "@/server/pipeline/regras-urgencia";
import { normalizarZapi } from "@/server/whatsapp/normalizar";
import { enviarNaConversa } from "@/server/whatsapp/send";

type Entrada = typeof s.whatsappEntradas.$inferSelect;
interface Opcao {
  condominioId: string;
  nome: string;
  moradorId: string | null;
}

const semAcento = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** "2" → 2ª opção; ou o nome do condomínio dentro do texto (uma só correspondência). */
export function escolherCondominio<T extends { nome: string }>(
  texto: string,
  opcoes: T[],
): T | null {
  const t = semAcento(texto.trim());
  const n = /^\d{1,2}$/.test(t) ? Number(t) : NaN;
  if (n >= 1 && n <= opcoes.length) return opcoes[n - 1]!;
  const achou = opcoes.filter((o) => t.includes(semAcento(o.nome)));
  return achou.length === 1 ? achou[0]! : null;
}

export const menuCondominios = (opcoes: { nome: string }[]) =>
  [
    "Olá! Para encaminhar sua mensagem, me diga de qual condomínio você é:",
    ...opcoes.map((o, i) => `${i + 1}. ${o.nome}`),
    "Responda com o número.",
  ].join("\n");

export const avisoEncaminhado = (nome: string) =>
  `Obrigado! Sua mensagem foi encaminhada à administração do ${nome}. A resposta chega por aqui.`;

export interface Roteado {
  /** Alerta a enfileirar (regra fixa de urgência), se houver. */
  alerta: JobAlerta | null;
  /** Mensagens novas com mídia, para baixar (e transcrever) fora da transação. */
  midias: JobMidia[];
  /** Resposta da IA a enfileirar (conversa com condomínio definido e com a IA). */
  agente: JobAgente | null;
}

/** Sobe a urgência da conversa (nunca desce); se estiver com a IA, passa para o síndico. */
export async function subirUrgencia(tx: Tx, conversaId: string, prioridade: "alta" | "critica") {
  await tx
    .update(s.conversas)
    .set({
      // A ordem do enum é normal < alta < critica.
      prioridade: sql`greatest(${s.conversas.prioridade}, ${prioridade}::prioridade)`,
      estado: sql`case when ${s.conversas.estado} = 'ia' then 'aguardando_sindico'::conversa_estado else ${s.conversas.estado} end`,
    })
    .where(eq(s.conversas.id, conversaId));
}

export async function rotear(job: JobMensagem, entradas: Entrada[]): Promise<Roteado> {
  return withTenant(job.tenantId, async (tx) => {
    // Condomínios em que o número está cadastrado (morador ativo, não recusado).
    const vinculos: Opcao[] = await tx
      .select({
        condominioId: s.condominios.id,
        nome: s.condominios.nome,
        moradorId: s.moradores.id,
      })
      .from(s.moradorContatos)
      .innerJoin(s.moradores, eq(s.moradores.id, s.moradorContatos.moradorId))
      .innerJoin(s.condominios, eq(s.condominios.id, s.moradorContatos.condominioId))
      .where(
        and(
          eq(s.moradorContatos.phoneE164, job.telefone),
          isNull(s.moradores.desativadoEm),
          ne(s.moradores.cadastro, "recusado"),
        ),
      )
      .orderBy(asc(s.condominios.nome));

    let [conversa] = await tx
      .select()
      .from(s.conversas)
      .where(
        and(
          eq(s.conversas.canalId, job.canalId),
          eq(s.conversas.endereco, job.telefone),
          ne(s.conversas.estado, "resolvida"),
        ),
      )
      .orderBy(desc(s.conversas.criadoEm))
      .limit(1);
    conversa ??= (
      await tx
        .insert(s.conversas)
        .values({
          tenantId: job.tenantId,
          canal: "whatsapp",
          canalId: job.canalId,
          endereco: job.telefone,
        })
        .returning()
    )[0]!;

    const msgs = entradas.map((e) => ({
      ...normalizarZapi(e.payload as object),
      id: e.providerMsgId,
    }));
    const novas = await tx
      .insert(s.mensagens)
      .values(
        msgs.map((m) => ({
          tenantId: job.tenantId,
          conversaId: conversa.id,
          direcao: "entrada" as const,
          autor: "morador" as const,
          tipo: m.tipo,
          texto: m.texto,
          providerMsgId: m.id,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: s.mensagens.id, providerMsgId: s.mensagens.providerMsgId });
    await tx
      .update(s.conversas)
      .set({ ultimaMsgEm: sql`now()` })
      .where(eq(s.conversas.id, conversa.id));

    // Regras fixas de urgência: independem da IA, do plano e do condomínio estar definido.
    const regra = msgs.map((m) => detectarUrgencia(m.texto)).find(Boolean) ?? null;
    const alerta: JobAlerta | null = regra
      ? { tenantId: job.tenantId, conversaId: conversa.id, regra: regra.id }
      : null;
    if (regra) await subirUrgencia(tx, conversa.id, regra.prioridade);

    // Só as mensagens gravadas agora (reprocessamento não baixa de novo).
    const midias: JobMidia[] = novas.flatMap((n) => {
      const m = msgs.find((x) => x.id === n.providerMsgId);
      return m?.midia
        ? [
            {
              tenantId: job.tenantId,
              mensagemId: n.id,
              conversaId: conversa.id,
              audio: m.tipo === "audio",
              ...m.midia,
            },
          ]
        : [];
    });
    const res: Roteado = { alerta, midias, agente: null };
    // Conta congelada por inadimplência (D+10): sem agente nem menu, só a resposta fixa (uma por
    // lote de mensagens). O alerta de urgência ao síndico continua.
    if ((await suspensaoDo(tx)) === "integral") {
      await tx
        .update(s.conversas)
        .set({ estado: "aguardando_sindico" })
        .where(eq(s.conversas.id, conversa.id));
      if (novas.length)
        await enviarNaConversa(tx, conversa, ATENDIMENTO_INDISPONIVEL, "sistema");
      return { ...res, midias: [] };
    }
    // Com IA: responde se a conversa segue com ela. Áudio novo espera a transcrição (a fila
    // "midia" chama o agente depois).
    const comIa = iaConfigurada();
    const pedirAgente = async () => {
      const [cv] = await tx
        .select({ estado: s.conversas.estado })
        .from(s.conversas)
        .where(eq(s.conversas.id, conversa.id));
      const audioNovo = novas.some(
        (n) => msgs.find((x) => x.id === n.providerMsgId)?.tipo === "audio",
      );
      if (comIa && cv?.estado === "ia" && novas.length && !audioNovo)
        res.agente = { tenantId: job.tenantId, conversaId: conversa.id };
    };

    if (conversa.condominioId) {
      await pedirAgente();
      return res;
    }

    // Opções: os condomínios do número; desconhecido → todos os do cliente.
    const opcoes: Opcao[] = vinculos.length
      ? vinculos.filter(
          (v, i) => vinculos.findIndex((x) => x.condominioId === v.condominioId) === i,
        )
      : (
          await tx
            .select({ condominioId: s.condominios.id, nome: s.condominios.nome })
            .from(s.condominios)
            .orderBy(asc(s.condominios.nome))
        ).map((c) => ({ ...c, moradorId: null }));
    if (!opcoes.length) {
      // Cliente sem condomínio cadastrado: fica para o síndico.
      await tx
        .update(s.conversas)
        .set({ estado: "aguardando_sindico" })
        .where(eq(s.conversas.id, conversa.id));
      return res;
    }

    let escolhido = opcoes.length === 1 ? opcoes[0]! : null;
    for (const m of [...msgs].reverse()) {
      if (escolhido) break;
      if (m.texto) escolhido = escolherCondominio(m.texto, opcoes);
    }
    if (!escolhido) {
      await enviarNaConversa(tx, conversa, menuCondominios(opcoes), "sistema");
      return res;
    }

    // Com IA, a conversa segue com ela (estado "ia", a menos que uma urgência já a tenha
    // passado ao síndico). Sem IA configurada, vai para o síndico com o aviso de sempre.
    await tx
      .update(s.conversas)
      .set({
        condominioId: escolhido.condominioId,
        moradorId: escolhido.moradorId,
        ...(comIa ? {} : { estado: "aguardando_sindico" as const }),
      })
      .where(eq(s.conversas.id, conversa.id));
    if (comIa) await pedirAgente();
    else await enviarNaConversa(tx, conversa, avisoEncaminhado(escolhido.nome), "sistema");
    return res;
  });
}
