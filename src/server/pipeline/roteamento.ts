/**
 * Roteamento sem IA: o canal já identifica o cliente; o telefone identifica o condomínio.
 * - 1 condomínio (morador conhecido, ou cliente com um só) → segue;
 * - vários, ou número desconhecido → menu numerado; a resposta (número ou nome) define.
 * Enquanto o condomínio não estiver definido, nada específico de condomínio é respondido.
 * Cadastro pendente do número desconhecido (unidade, nome, LGPD) é outra etapa.
 * Roda dentro de `withTenant` (oc_app, sujeito à RLS).
 */
import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { schema as s, withTenant } from "@/server/db";
import type { JobMensagem } from "@/server/queue";
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

export async function rotear(job: JobMensagem, entradas: Entrada[]) {
  await withTenant(job.tenantId, async (tx) => {
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
          eq(s.conversas.phoneE164, job.telefone),
          ne(s.conversas.estado, "resolvida"),
        ),
      )
      .orderBy(desc(s.conversas.criadoEm))
      .limit(1);
    conversa ??= (
      await tx
        .insert(s.conversas)
        .values({ tenantId: job.tenantId, canalId: job.canalId, phoneE164: job.telefone })
        .returning()
    )[0]!;

    const msgs = entradas.map((e) => ({
      ...normalizarZapi(e.payload as object),
      id: e.providerMsgId,
    }));
    await tx
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
      .onConflictDoNothing();
    await tx
      .update(s.conversas)
      .set({ ultimaMsgEm: sql`now()` })
      .where(eq(s.conversas.id, conversa.id));

    if (conversa.condominioId) return;

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
      return;
    }

    let escolhido = opcoes.length === 1 ? opcoes[0]! : null;
    for (const m of [...msgs].reverse()) {
      if (escolhido) break;
      if (m.texto) escolhido = escolherCondominio(m.texto, opcoes);
    }
    if (!escolhido) {
      await enviarNaConversa(tx, conversa, menuCondominios(opcoes), "sistema");
      return;
    }

    // ponytail: sem agente ainda, toda conversa com condomínio vai para o síndico; na Fase 3
    // o estado inicial passa a ser "ia".
    await tx
      .update(s.conversas)
      .set({
        condominioId: escolhido.condominioId,
        moradorId: escolhido.moradorId,
        estado: "aguardando_sindico",
      })
      .where(eq(s.conversas.id, conversa.id));
    await enviarNaConversa(tx, conversa, avisoEncaminhado(escolhido.nome), "sistema");
  });
}
