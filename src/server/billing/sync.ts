/**
 * Worker da fila `stripe`: espelha no banco o estado atual do Stripe. Cada evento só diz *o que*
 * mudou; o objeto é sempre buscado de novo na API (eventos chegam fora de ordem e repetidos).
 *
 * A conta Stripe é dividida com o OperaCondo Insights: objeto de cliente Stripe que não é de um
 * cliente do Concierge (`tenants.stripe_customer_id`) é ignorado.
 */
import { and, desc, eq, isNull, lt, min } from "drizzle-orm";
import type Stripe from "stripe";
import { dbAdmin, schema as s } from "@/server/db";
import { stripe } from "./stripe";

type AssinaturaStatus = (typeof s.assinaturaStatus.enumValues)[number];
type TenantStatus = (typeof s.tenantStatus.enumValues)[number];
type Suspensao = (typeof s.suspensao.enumValues)[number];

const FUSO = "America/Sao_Paulo";
/** Data (AAAA-MM-DD) no fuso de São Paulo. */
export const dataSP = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: FUSO });
const deUnix = (t: number | null | undefined) => (t ? new Date(t * 1000) : null);
const idDe = (x: string | { id: string } | null | undefined) =>
  typeof x === "string" ? x : (x?.id ?? null);

/**
 * Status do cliente derivado da assinatura e das faturas (nunca editado à mão). `suspensao` é
 * aplicada pelo job diário de inadimplência (#35); aqui só vira `suspenso` quando é integral.
 */
export function statusDoCliente(
  assinatura: AssinaturaStatus | null,
  atual: TenantStatus,
  temVencida: boolean,
  suspensao: Suspensao,
): TenantStatus {
  if (atual === "excluido" || !assinatura) return atual;
  const base: TenantStatus = (
    {
      trialing: temVencida ? "inadimplente" : "trial",
      active: temVencida ? "inadimplente" : "ativo",
      past_due: "inadimplente",
      unpaid: "inadimplente",
      paused: "suspenso",
      canceled: "cancelado",
      incomplete_expired: "cancelado",
      // 1º pagamento ainda pendente: nada muda até o Stripe decidir.
      incomplete: atual,
    } as const
  )[assinatura];
  return base === "inadimplente" && suspensao === "integral" ? "suspenso" : base;
}

/** `concierge_{plano}_{mensal|anual}` → plano e intervalo. */
export function planoDoLookupKey(lookupKey: string | null) {
  const m = lookupKey?.match(/^concierge_(.+)_(mensal|anual)$/);
  return m ? { planoId: m[1]!, intervalo: m[2] as "mensal" | "anual" } : null;
}

async function tenantDoCustomer(customer: string | { id: string } | null) {
  const id = idDe(customer);
  if (!id) return null;
  const [t] = await dbAdmin()
    .select({ id: s.tenants.id })
    .from(s.tenants)
    .where(eq(s.tenants.stripeCustomerId, id));
  return t?.id ?? null;
}

/** Recalcula `tenants.status`, `inadimplente_desde` e libera a suspensão quando tudo foi pago. */
export async function derivarCliente(tenantId: string, hoje = dataSP(new Date())) {
  const db = dbAdmin();
  const [t] = await db.select().from(s.tenants).where(eq(s.tenants.id, tenantId));
  if (!t) return;
  const [a] = await db
    .select({ status: s.assinaturas.status })
    .from(s.assinaturas)
    .where(eq(s.assinaturas.tenantId, tenantId))
    .orderBy(desc(s.assinaturas.criadoEm))
    .limit(1);
  const [v] = await db
    .select({ desde: min(s.faturas.vencimento) })
    .from(s.faturas)
    .where(
      and(
        eq(s.faturas.tenantId, tenantId),
        eq(s.faturas.status, "open"),
        lt(s.faturas.vencimento, hoje),
      ),
    );
  const desde = v?.desde ?? null;
  const emAtraso = Boolean(desde) || a?.status === "past_due" || a?.status === "unpaid";
  const suspensao: Suspensao = emAtraso ? t.suspensao : "nenhuma";
  await db
    .update(s.tenants)
    .set({
      status: statusDoCliente(a?.status ?? null, t.status, Boolean(desde), suspensao),
      inadimplenteDesde: emAtraso ? (t.inadimplenteDesde ?? desde ?? hoje) : null,
      suspensao,
    })
    .where(eq(s.tenants.id, tenantId));
}

export async function sincronizarAssinatura(subscriptionId: string, st: Stripe = stripe()) {
  const sub = await st.subscriptions.retrieve(subscriptionId, {
    expand: ["default_payment_method"],
  });
  const tenantId = await tenantDoCustomer(sub.customer);
  if (!tenantId) return null;

  const db = dbAdmin();
  const planos = new Set((await db.select({ id: s.planos.id }).from(s.planos)).map((p) => p.id));
  const item = sub.items.data.find((i) => {
    const p = planoDoLookupKey(i.price.lookup_key);
    return p && planos.has(p.planoId);
  });
  if (!item) return null; // assinatura de outro produto (ex.: Insights)
  const { planoId, intervalo } = planoDoLookupKey(item.price.lookup_key)!;
  const pm = sub.default_payment_method;
  const valores = {
    tenantId,
    planoId,
    status: sub.status as AssinaturaStatus,
    formaCobranca:
      sub.collection_method === "send_invoice" ? ("boleto" as const) : ("cartao" as const),
    intervalo,
    quantidadeCondominios: item.quantity ?? 1,
    cartaoFingerprint: typeof pm === "object" && pm?.card ? pm.card.fingerprint : null,
    periodoInicio: deUnix(item.current_period_start),
    periodoFim: deUnix(item.current_period_end),
    trialFim: deUnix(sub.trial_end),
    cancelaNoFim: sub.cancel_at_period_end,
    canceladaEm: deUnix(sub.canceled_at),
    atualizadoEm: new Date(),
  };
  const [linha] = await db
    .insert(s.assinaturas)
    .values({ ...valores, stripeSubscriptionId: sub.id })
    .onConflictDoUpdate({ target: s.assinaturas.stripeSubscriptionId, set: valores })
    .returning({ id: s.assinaturas.id });
  await derivarCliente(tenantId);
  return { tenantId, assinaturaId: linha!.id, faturaId: idDe(sub.latest_invoice) };
}

const METODO = { card: "cartao", boleto: "boleto", pix: "pix" } as const;

export async function sincronizarFatura(invoiceId: string, st: Stripe = stripe()) {
  const inv = await st.invoices.retrieve(invoiceId);
  if (!inv.id) return null;
  const tenantId = await tenantDoCustomer(inv.customer);
  if (!tenantId) return null;
  const db = dbAdmin();

  const subId = idDe(inv.parent?.subscription_details?.subscription);
  let assinaturaId: string | null = null;
  if (subId) {
    const [a] = await db
      .select({ id: s.assinaturas.id })
      .from(s.assinaturas)
      .where(
        and(eq(s.assinaturas.tenantId, tenantId), eq(s.assinaturas.stripeSubscriptionId, subId)),
      );
    assinaturaId = a?.id ?? (await sincronizarAssinatura(subId, st))?.assinaturaId ?? null;
  }

  // Meio de pagamento e estorno vêm da cobrança de cada pagamento da fatura.
  const pagamentos = await st.invoicePayments.list({
    invoice: inv.id,
    expand: ["data.payment.payment_intent.latest_charge"],
  });
  let metodo: (typeof METODO)[keyof typeof METODO] | null = null;
  let estornado = 0;
  for (const p of pagamentos.data) {
    const pi = p.payment.payment_intent;
    const charge = typeof pi === "object" && pi ? pi.latest_charge : null;
    if (typeof charge !== "object" || !charge) continue;
    estornado += charge.amount_refunded;
    const tipo = charge.payment_method_details?.type as keyof typeof METODO | undefined;
    if (p.status === "paid" && tipo && tipo in METODO) metodo = METODO[tipo];
  }

  // Cartão não tem vencimento no Stripe: vale a data em que a fatura foi emitida.
  const vencimento = deUnix(inv.due_date ?? inv.status_transitions.finalized_at);
  const valores = {
    tenantId,
    assinaturaId,
    numero: inv.number,
    status: (inv.status ?? "draft") as (typeof s.faturaStatus.enumValues)[number],
    valorTotal: inv.total / 100,
    valorPago: inv.amount_paid / 100,
    valorEstornado: estornado / 100,
    vencimento: vencimento ? dataSP(vencimento) : null,
    pagoEm: deUnix(inv.status_transitions.paid_at),
    metodoPagamento: metodo,
    urlFatura: inv.hosted_invoice_url ?? null,
    urlPdf: inv.invoice_pdf ?? null,
  };
  await db
    .insert(s.faturas)
    .values({ ...valores, stripeInvoiceId: inv.id })
    .onConflictDoUpdate({ target: s.faturas.stripeInvoiceId, set: valores });
  await derivarCliente(tenantId);
  return { tenantId };
}

/** Checkout concluído: liga o cliente Stripe ao cliente do Concierge (`client_reference_id`). */
async function concluirCheckout(sessionId: string, st: Stripe) {
  const sessao = await st.checkout.sessions.retrieve(sessionId);
  const tenantId = sessao.client_reference_id ?? sessao.metadata?.tenant_id;
  const customer = idDe(sessao.customer);
  if (!tenantId || !customer || !/^[0-9a-f-]{36}$/i.test(tenantId)) return;
  const db = dbAdmin();
  const ligado = await db
    .update(s.tenants)
    .set({ stripeCustomerId: customer })
    .where(and(eq(s.tenants.id, tenantId), isNull(s.tenants.stripeCustomerId)))
    .returning({ id: s.tenants.id });
  if (!ligado.length && (await tenantDoCustomer(customer)) !== tenantId)
    throw new Error(`checkout ${sessionId}: o cliente já está ligado a outro cliente Stripe`);
  const subId = idDe(sessao.subscription);
  if (!subId) return;
  const r = await sincronizarAssinatura(subId, st);
  if (r?.faturaId) await sincronizarFatura(r.faturaId, st);
}

/** Processa um evento gravado em `stripe_eventos`. Erro fica no evento e a fila tenta de novo. */
export async function processarEventoStripe(eventId: string, st: Stripe = stripe()) {
  const db = dbAdmin();
  const [e] = await db.select().from(s.stripeEventos).where(eq(s.stripeEventos.eventId, eventId));
  if (!e || e.processadoEm) return;
  const objeto = (e.payload as Stripe.Event).data.object as {
    id: string;
    payment_intent?: unknown;
  };
  try {
    if (e.tipo === "checkout.session.completed") await concluirCheckout(objeto.id, st);
    else if (e.tipo.startsWith("customer.subscription."))
      await sincronizarAssinatura(objeto.id, st);
    else if (e.tipo.startsWith("invoice.")) await sincronizarFatura(objeto.id, st);
    else if (e.tipo === "charge.refunded") {
      const pi = idDe(objeto.payment_intent as string | { id: string } | null);
      if (pi) {
        const pags = await st.invoicePayments.list({
          payment: { type: "payment_intent", payment_intent: pi },
        });
        for (const p of pags.data) {
          const inv = idDe(p.invoice as string | { id: string });
          if (inv) await sincronizarFatura(inv, st);
        }
      }
    }
    // customer.updated: nada a espelhar por enquanto (só auditoria em stripe_eventos).
    await db
      .update(s.stripeEventos)
      .set({ processadoEm: new Date(), erro: null })
      .where(eq(s.stripeEventos.eventId, eventId));
  } catch (err) {
    await db
      .update(s.stripeEventos)
      .set({ erro: err instanceof Error ? err.message : String(err) })
      .where(eq(s.stripeEventos.eventId, eventId));
    throw err;
  }
}
