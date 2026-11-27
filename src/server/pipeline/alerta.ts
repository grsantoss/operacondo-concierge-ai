/**
 * Job da fila "alerta": avisa por WhatsApp os síndicos com número de alerta cadastrado e
 * (`atenderUrgencia`, #101) confirma ao morador e abre a demanda da regra, sem IA.
 */
import { and, desc, eq, gt, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { PRIO_TELA, proximoCodigoDemanda, SLA_HORAS } from "@/lib/demandas.functions";
import { formatarTelefone } from "@/lib/telefone";
import { suspensaoDo } from "@/server/billing/limites";
import { schema as s, withTenant, type Tx } from "@/server/db";
import { emailConfigurado } from "@/server/email";
import type { JobAlerta } from "@/server/queue";
import { REGRAS, type RegraUrgencia } from "@/server/pipeline/regras-urgencia";
import { enviarNaConversa } from "@/server/whatsapp/send";
import { credDoCanal, enviarTextoZapi } from "@/server/whatsapp/zapi";

/** Resposta fixa ao morador numa urgência (texto final a aprovar; orientação de segurança: #64). */
export const CONFIRMACAO_URGENCIA =
  "Recebemos sua mensagem e já encaminhamos ao responsável pelo condomínio, que foi avisado agora.";
/** Mesma janela do alerta: a confirmação não se repete a cada mensagem. */
const JANELA_MS = 30 * 60_000;

async function ultimaEntrada(tx: Tx, conversaId: string) {
  const [m] = await tx
    .select({
      texto: sql<string | null>`coalesce(${s.mensagens.texto}, ${s.mensagens.transcricao})`,
    })
    .from(s.mensagens)
    .where(and(eq(s.mensagens.conversaId, conversaId), eq(s.mensagens.direcao, "entrada")))
    .orderBy(desc(s.mensagens.criadoEm))
    .limit(1);
  return m?.texto ?? null;
}

/**
 * Roda depois do alerta, já com o condomínio definido pelo roteamento. Idempotente: a nova
 * tentativa do job não abre outra demanda nem confirma de novo.
 */
export async function atenderUrgencia(job: JobAlerta) {
  const regra = REGRAS.find((r) => r.id === job.regra);
  if (!regra) return;
  await withTenant(job.tenantId, async (tx) => {
    const [cv] = await tx.select().from(s.conversas).where(eq(s.conversas.id, job.conversaId));
    if (!cv) return;
    const texto = await ultimaEntrada(tx, cv.id);
    // Demanda exige condomínio: sem ele (número desconhecido com vários), fica a conversa Crítica.
    if (cv.condominioId) await abrirDemandaDaRegra(tx, cv, regra, texto);

    // Congelado (D+10): o morador já recebeu "atendimento indisponível".
    if (job.confirmar === false || (await suspensaoDo(tx)) === "integral") return;
    if (cv.canal === "email" && !emailConfigurado()) {
      console.warn("[alerta] SES_REMETENTE vazio: confirmação de urgência por e-mail não enviada");
      return;
    }
    const [ja] = await tx
      .select({ id: s.mensagens.id })
      .from(s.mensagens)
      .where(
        and(
          eq(s.mensagens.conversaId, cv.id),
          eq(s.mensagens.texto, CONFIRMACAO_URGENCIA),
          gt(s.mensagens.criadoEm, new Date(Date.now() - JANELA_MS)),
        ),
      )
      .limit(1);
    if (!ja) await enviarNaConversa(tx, cv, CONFIRMACAO_URGENCIA, "sistema");
  });
}

async function abrirDemandaDaRegra(
  tx: Tx,
  cv: typeof s.conversas.$inferSelect,
  regra: RegraUrgencia,
  texto: string | null,
) {
  const [aberta] = await tx
    .select({ id: s.demandas.id })
    .from(s.demandas)
    .where(
      and(
        eq(s.demandas.conversaId, cv.id),
        eq(s.demandas.titulo, regra.rotulo),
        ne(s.demandas.coluna, "resolvidas"),
      ),
    )
    .limit(1);
  if (aberta) return;
  const [morador] = cv.moradorId
    ? await tx
        .select({ unidadeId: s.moradores.unidadeId })
        .from(s.moradores)
        .where(eq(s.moradores.id, cv.moradorId))
    : [];
  const [nova] = await tx
    .insert(s.demandas)
    .values({
      tenantId: cv.tenantId,
      codigo: await proximoCodigoDemanda(tx),
      condominioId: cv.condominioId!,
      moradorId: cv.moradorId,
      unidadeId: morador?.unidadeId ?? null,
      conversaId: cv.id,
      titulo: regra.rotulo,
      descricao: texto?.slice(0, 1200) ?? null,
      categoria: regra.categoria,
      prioridade: regra.prioridade,
      slaAte: new Date(Date.now() + SLA_HORAS[PRIO_TELA[regra.prioridade]] * 3_600_000),
    })
    .returning({ id: s.demandas.id });
  await tx.insert(s.demandaEventos).values({
    tenantId: cv.tenantId,
    demandaId: nova!.id,
    ator: "Concierge",
    acao: `Abriu a demanda pela regra de urgência (${cv.canal === "email" ? "e-mail" : "WhatsApp"})`,
    canal: "sistema",
  });
}

export async function enviarAlerta(job: JobAlerta): Promise<number> {
  const regra = REGRAS.find((r) => r.id === job.regra);
  if (!regra) return 0;
  return withTenant(job.tenantId, async (tx) => {
    const [cv] = await tx
      .select({
        conversa: s.conversas,
        condominio: s.condominios.nome,
        morador: s.moradores.nome,
        canal: s.whatsappCanais,
      })
      .from(s.conversas)
      // O alerta sai pelo WhatsApp do cliente (um por cliente), seja qual for o canal da conversa.
      .innerJoin(s.whatsappCanais, eq(s.whatsappCanais.tenantId, s.conversas.tenantId))
      .leftJoin(s.condominios, eq(s.condominios.id, s.conversas.condominioId))
      .leftJoin(s.moradores, eq(s.moradores.id, s.conversas.moradorId))
      .where(eq(s.conversas.id, job.conversaId));
    if (!cv) return 0;
    const condominioId = cv.conversa.condominioId;
    // Síndicos/admins com número; quem tem lista de condomínios só recebe dos seus. Sem
    // condomínio definido (número desconhecido), avisa todos: não dá para saber de qual é.
    const destinos = await tx
      .select({ fone: s.membros.alertaE164 })
      .from(s.membros)
      .where(
        and(
          inArray(s.membros.papel, ["sindico", "admin"]),
          isNotNull(s.membros.alertaE164),
          condominioId
            ? sql`(cardinality(${s.membros.condominioIds}) = 0 or ${condominioId}::uuid = any(${s.membros.condominioIds}))`
            : undefined,
        ),
      );
    if (!destinos.length) return 0;
    const ultima = await ultimaEntrada(tx, cv.conversa.id);
    const quem = [
      cv.condominio ?? "Condomínio ainda não definido",
      cv.morador ?? "número não cadastrado",
      formatarTelefone(cv.conversa.endereco),
    ].join(" • ");
    const base = (process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "").replace(/\/+$/, "");
    const texto = [
      `🚨 Alerta de urgência: ${regra.rotulo}`,
      quem,
      ultima ? `Mensagem: "${ultima.slice(0, 300)}"` : null,
      base ? `Abra a conversa: ${base}/app/agente` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const cred = credDoCanal(cv.canal);
    // Um destino com falha faz o job inteiro tentar de novo; quem já recebeu pode receber 2 vezes.
    for (const d of destinos) await enviarTextoZapi(cred, d.fone!, texto);
    return destinos.length;
  });
}
