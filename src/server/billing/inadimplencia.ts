/**
 * Job diário de inadimplência (#35), contado a partir de `tenants.inadimplente_desde` (vencimento
 * da fatura não paga): D+1 aviso, D+7 suspensão parcial, D+10 congelado, D+20 e D+27 aviso da
 * exclusão, D+30 exclusão da conta. Pagar a fatura reativa na hora (`derivarCliente`, no webhook).
 */
import { and, eq, inArray, isNotNull, isNull, notExists, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { apagarPasta } from "@/server/arquivos";
import { stripe, stripeConfigurado } from "@/server/billing/stripe";
import { dataSP, derivarCliente, sincronizarAssinatura } from "@/server/billing/sync";
import { dbAdmin, schema as s } from "@/server/db";
import { enviarEmail } from "@/server/email";
import { credDoCanal, desconectarZapi } from "@/server/whatsapp/zapi";

type Suspensao = (typeof s.suspensao.enumValues)[number];

export const DIAS = { parcial: 7, integral: 10, exclusao: 30 } as const;
/** Dias em que o síndico recebe e-mail. */
export const AVISOS = [1, 7, 10, 20, 27] as const;

const diasEntre = (de: string, ate: string) =>
  Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 864e5);

const somarDias = (dia: string, n: number) =>
  new Date(Date.parse(`${dia}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

export function fase(dias: number): Suspensao | "exclusao" {
  if (dias >= DIAS.exclusao) return "exclusao";
  if (dias >= DIAS.integral) return "integral";
  if (dias >= DIAS.parcial) return "parcial";
  return "nenhuma";
}

/** Aviso que falta mandar hoje (o maior dia já alcançado e ainda não enviado), ou null. */
export function avisoDevido(dias: number, ultimo: number): number | null {
  const devido = [...AVISOS].reverse().find((d) => dias >= d);
  return devido && devido > ultimo ? devido : null;
}

/** E-mails do cliente: o do cadastro e os dos síndicos. */
async function destinatarios(tenantId: string, email: string | null) {
  const sindicos = await dbAdmin()
    .select({ email: s.user.email })
    .from(s.membros)
    .innerJoin(s.user, eq(s.user.id, s.membros.userId))
    .where(and(eq(s.membros.tenantId, tenantId), eq(s.membros.papel, "sindico")));
  return [email ?? "", ...sindicos.map((x) => x.email)];
}

const br = (dia: string) => dia.split("-").reverse().join("/");

interface Datas {
  nome: string;
  desde: string;
  parcial: string;
  integral: string;
  exclusao: string;
  url: string;
}

/** Texto de cada aviso por e-mail (D+1, 7, 10, 20, 27). */
export function textoAviso(dia: number, d: Datas): { assunto: string; texto: string } {
  const pagar = `Para regularizar, pague a fatura em aberto: ${d.url}`;
  const fim = "\n\nSe o pagamento já foi feito, desconsidere esta mensagem.\nOperaCondo Concierge";
  const corpo: Record<number, [string, string]> = {
    1: [
      "Fatura do OperaCondo Concierge em atraso",
      `A fatura de ${d.nome} venceu em ${br(d.desde)} e ainda não foi paga. Tudo segue funcionando por enquanto; em ${br(d.parcial)} o painel fica só para leitura e o agente deixa de usar a IA.`,
    ],
    7: [
      "Conta suspensa parcialmente por falta de pagamento",
      `Desde hoje o painel de ${d.nome} está só para leitura e o agente responde com mensagem fixa (urgências continuam sendo repassadas). Em ${br(d.integral)} a conta será congelada.`,
    ],
    10: [
      "Conta congelada por falta de pagamento",
      `A conta de ${d.nome} está congelada: o painel só abre a tela de pagamento e o WhatsApp responde "atendimento indisponível". Sem pagamento, os dados serão excluídos em ${br(d.exclusao)}.`,
    ],
    20: [
      `Seus dados serão excluídos em ${br(d.exclusao)}`,
      `A conta de ${d.nome} segue congelada. Em ${br(d.exclusao)} moradores, conversas, demandas e documentos serão excluídos de vez.`,
    ],
    27: [
      `Últimos dias: exclusão em ${br(d.exclusao)}`,
      `Em ${br(d.exclusao)} a conta de ${d.nome} será excluída, com moradores, conversas, demandas e documentos. Essa ação não pode ser desfeita.`,
    ],
  };
  const [assunto, texto] = corpo[dia]!;
  return { assunto, texto: `${texto}\n\n${pagar}${fim}` };
}

/** Roda uma vez por dia (fila `inadimplencia`, agendada no worker). */
export async function aplicarInadimplencia(
  hoje = dataSP(new Date()),
  st?: Stripe,
  apagar: (prefixo: string) => Promise<void> = apagarPasta,
) {
  const db = dbAdmin();
  const clientes = await db
    .select()
    .from(s.tenants)
    .where(and(isNotNull(s.tenants.inadimplenteDesde), isNull(s.tenants.excluidoEm)));
  for (const t of clientes) {
    try {
      const desde = t.inadimplenteDesde!;
      const dias = diasEntre(desde, hoje);
      const exclusao = somarDias(desde, DIAS.exclusao);
      const f = fase(dias);
      if (f === "exclusao") {
        await excluirCliente(t.id, st, apagar);
        continue;
      }
      const aviso = avisoDevido(dias, t.avisoInadimplencia);
      await db
        .update(s.tenants)
        .set({
          suspensao: f,
          exclusaoPrevistaEm: exclusao,
          ...(aviso ? { avisoInadimplencia: aviso } : {}),
        })
        .where(eq(s.tenants.id, t.id));
      await derivarCliente(t.id, hoje);
      if (aviso) {
        const { assunto, texto } = textoAviso(aviso, {
          nome: t.nomeFantasia,
          desde,
          parcial: somarDias(desde, DIAS.parcial),
          integral: somarDias(desde, DIAS.integral),
          exclusao,
          url: `${(process.env.APP_URL ?? "").replace(/\/+$/, "")}/app/configuracoes?aba=plano`,
        });
        await enviarEmail({ para: await destinatarios(t.id, t.email), assunto, texto });
      }
    } catch (e) {
      // Um cliente com erro não trava os outros; o próximo dia tenta de novo.
      console.error(`[inadimplencia] cliente ${t.id}:`, e);
    }
  }
}

/** Tabelas apagadas na exclusão, filhas antes das mães. Ficam: assinaturas, faturas, trial_usos. */
export const TABELAS_APAGADAS = [
  "llm_execucoes",
  "demanda_anexos",
  "demanda_eventos",
  "demandas",
  "mensagens",
  "conversas",
  "whatsapp_entradas",
  "whatsapp_canais",
  "consentimentos",
  "morador_contatos",
  "moradores",
  "unidades",
  "fornecedor_documentos",
  "fornecedores",
  "documento_trechos",
  "documentos",
  "agente_config",
  "condominios",
  "membros",
] as const;

/**
 * D+30: cancela a assinatura no Stripe, desconecta o WhatsApp, apaga os dados e os arquivos.
 * Mantém faturas, assinaturas e os dados fiscais (razão social, CNPJ) com o resto anonimizado.
 */
export async function excluirCliente(
  tenantId: string,
  st?: Stripe,
  apagar: (prefixo: string) => Promise<void> = apagarPasta,
) {
  const db = dbAdmin();
  const assinaturas = await db
    .select()
    .from(s.assinaturas)
    .where(
      and(
        eq(s.assinaturas.tenantId, tenantId),
        isNotNull(s.assinaturas.stripeSubscriptionId),
        sql`${s.assinaturas.status} not in ('canceled', 'incomplete_expired')`,
      ),
    );
  if (assinaturas.length) {
    // Sem Stripe não dá para parar a cobrança: não exclui (tenta de novo amanhã).
    if (!st && !stripeConfigurado())
      throw new Error("Stripe não configurado: a assinatura não pode ser cancelada");
    const cli = st ?? stripe();
    for (const a of assinaturas) {
      await cli.subscriptions.cancel(a.stripeSubscriptionId!);
      await sincronizarAssinatura(a.stripeSubscriptionId!, cli);
    }
  }

  const canais = await db
    .select()
    .from(s.whatsappCanais)
    .where(eq(s.whatsappCanais.tenantId, tenantId));
  for (const c of canais) {
    if (c.provider !== "zapi") continue;
    try {
      await desconectarZapi(credDoCanal(c));
    } catch (e) {
      console.warn(`[inadimplencia] Z-API não desconectou o canal ${c.id}:`, e);
    }
  }

  await apagar(`${tenantId}/`);

  const membros = await db
    .select({ userId: s.membros.userId })
    .from(s.membros)
    .where(eq(s.membros.tenantId, tenantId));
  await db.transaction(async (tx) => {
    for (const tabela of TABELAS_APAGADAS)
      await tx.execute(sql`delete from ${sql.identifier(tabela)} where tenant_id = ${tenantId}`);
    // Logins que só davam acesso a este cliente (o Admin Master nunca).
    const ids = membros.map((m) => m.userId);
    if (ids.length)
      await tx
        .delete(s.user)
        .where(
          and(
            inArray(s.user.id, ids),
            sql`${s.user.role} <> 'admin'`,
            notExists(tx.select().from(s.membros).where(eq(s.membros.userId, s.user.id))),
          ),
        );
    await tx
      .update(s.tenants)
      .set({
        email: null,
        telefone: null,
        responsavel: null,
        status: "excluido",
        suspensao: "integral",
        excluidoEm: new Date(),
      })
      .where(eq(s.tenants.id, tenantId));
  });
}
