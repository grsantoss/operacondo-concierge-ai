/** Webhook do Stripe → stripe_eventos → fila → espelho no banco. Precisa do banco local. */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import Stripe from "stripe";
import { processarEventoStripe, statusDoCliente } from "../src/server/billing/sync";
import { receberWebhookStripe } from "../src/server/billing/webhook";
import { dbAdmin, schema as s } from "../src/server/db";

const admin = dbAdmin();
const SEGREDO = "whsec_teste";
const sufixo = Date.now().toString(36);
const CUS = `cus_teste_${sufixo}`;
const SUB = `sub_teste_${sufixo}`;
const INV = `in_teste_${sufixo}`;
let tenantId: string;

const agora = Math.floor(Date.now() / 1000);
const dia = 86400;
// Estado "atual" no Stripe falso; os testes mudam e o worker sempre lê daqui.
const estado = {
  sub: {
    id: SUB,
    customer: CUS,
    status: "active",
    collection_method: "charge_automatically",
    default_payment_method: { card: { fingerprint: "fp_123" } },
    trial_end: null,
    cancel_at_period_end: false,
    canceled_at: null,
    latest_invoice: INV,
    items: {
      data: [
        {
          quantity: 2,
          current_period_start: agora,
          current_period_end: agora + 30 * dia,
          price: { lookup_key: "concierge_essencial_mensal" },
        },
      ],
    },
  } as Record<string, unknown>,
  inv: {
    id: INV,
    customer: CUS,
    number: "OC-0001",
    status: "open",
    total: 29400,
    amount_paid: 0,
    due_date: agora - 3 * dia,
    status_transitions: { finalized_at: agora - 5 * dia, paid_at: null },
    hosted_invoice_url: "https://invoice.stripe.com/i/x",
    invoice_pdf: "https://pay.stripe.com/x.pdf",
    parent: { subscription_details: { subscription: SUB } },
  } as Record<string, unknown>,
  pagamentos: [] as unknown[],
};
const falso = {
  subscriptions: { retrieve: async () => estado.sub },
  invoices: { retrieve: async () => estado.inv },
  invoicePayments: { list: async () => ({ data: estado.pagamentos }) },
  checkout: {
    sessions: {
      retrieve: async () => ({ client_reference_id: tenantId, customer: CUS, subscription: SUB }),
    },
  },
} as unknown as Stripe;

const post = async (evento: object, segredo = SEGREDO) => {
  const corpo = JSON.stringify(evento);
  const header = await Stripe.webhooks.generateTestHeaderStringAsync({
    payload: corpo,
    secret: segredo,
  });
  return receberWebhookStripe(
    new Request("http://x/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": header },
      body: corpo,
    }),
  );
};
let seq = 0;
const evento = (type: string, objeto: object) => ({
  id: `evt_teste_${sufixo}_${++seq}`,
  object: "event",
  type,
  data: { object: objeto },
});
/** Recebe pelo webhook e processa como o worker faria. */
const receber = async (type: string, objeto: object) => {
  const e = evento(type, objeto);
  expect((await post(e)).status).toBe(200);
  await processarEventoStripe(e.id, falso);
  return e.id;
};
const cliente = async () =>
  (await admin.select().from(s.tenants).where(eq(s.tenants.id, tenantId)))[0]!;

beforeAll(async () => {
  process.env.STRIPE_WEBHOOK_SECRET = SEGREDO;
  const [t] = await admin
    .insert(s.tenants)
    .values({ razaoSocial: "Teste Stripe", nomeFantasia: "Teste Stripe" })
    .returning();
  tenantId = t!.id;
});

afterAll(async () => {
  await admin.delete(s.faturas).where(eq(s.faturas.tenantId, tenantId));
  await admin.delete(s.assinaturas).where(eq(s.assinaturas.tenantId, tenantId));
  await admin.delete(s.tenants).where(eq(s.tenants.id, tenantId));
  await admin.execute(
    sql`delete from stripe_eventos where event_id like ${`evt_teste_${sufixo}_%`}`,
  );
  await admin.execute(
    sql`delete from pgboss.job where name = 'stripe' and singleton_key like ${`evt_teste_${sufixo}_%`}`,
  );
});

test("assinatura inválida ou ausente → 400, nada gravado", async () => {
  const e = evento("invoice.paid", { id: INV });
  expect((await post(e, "whsec_outro")).status).toBe(400);
  const r = await receberWebhookStripe(
    new Request("http://x", { method: "POST", body: JSON.stringify(e) }),
  );
  expect(r.status).toBe(400);
  expect(await admin.$count(s.stripeEventos, eq(s.stripeEventos.eventId, e.id))).toBe(0);
});

test("evento fora da lista → 200 e descartado", async () => {
  const e = evento("payment_intent.created", { id: "pi_x" });
  expect((await post(e)).status).toBe(200);
  expect(await admin.$count(s.stripeEventos, eq(s.stripeEventos.eventId, e.id))).toBe(0);
});

test("evento repetido grava uma vez e enfileira um job", async () => {
  const e = evento("customer.updated", { id: CUS });
  await post(e);
  await post(e);
  expect(await admin.$count(s.stripeEventos, eq(s.stripeEventos.eventId, e.id))).toBe(1);
  const { rows } = await admin.execute<{ n: number }>(
    sql`select count(*)::int as n from pgboss.job where name = 'stripe' and singleton_key = ${e.id}`,
  );
  expect(rows[0]!.n).toBe(1);
});

test("customer desconhecido (ex.: Insights) é ignorado sem erro", async () => {
  const id = await receber("customer.subscription.updated", { id: SUB });
  const [e] = await admin.select().from(s.stripeEventos).where(eq(s.stripeEventos.eventId, id));
  expect(e!.processadoEm).not.toBeNull();
  expect(await admin.$count(s.assinaturas, eq(s.assinaturas.tenantId, tenantId))).toBe(0);
});

test("checkout liga o cliente e espelha assinatura e fatura vencida", async () => {
  await receber("checkout.session.completed", { id: "cs_x" });
  const t = await cliente();
  expect(t.stripeCustomerId).toBe(CUS);
  const [a] = await admin.select().from(s.assinaturas).where(eq(s.assinaturas.tenantId, tenantId));
  expect(a).toMatchObject({
    planoId: "essencial",
    intervalo: "mensal",
    quantidadeCondominios: 2,
    formaCobranca: "cartao",
    cartaoFingerprint: "fp_123",
    status: "active",
  });
  const [f] = await admin.select().from(s.faturas).where(eq(s.faturas.tenantId, tenantId));
  expect(f).toMatchObject({ status: "open", valorTotal: 294, assinaturaId: a!.id });
  // Fatura aberta com vencimento passado → inadimplente desde o vencimento.
  expect(t.status).toBe("inadimplente");
  expect(t.inadimplenteDesde).toBe(f!.vencimento);
});

test("pagamento: evento antigo chega depois e não desfaz (lê o estado atual)", async () => {
  estado.inv = {
    ...estado.inv,
    status: "paid",
    amount_paid: 29400,
    status_transitions: { finalized_at: agora - 5 * dia, paid_at: agora },
  };
  estado.pagamentos = [
    {
      status: "paid",
      payment: {
        payment_intent: {
          latest_charge: { amount_refunded: 0, payment_method_details: { type: "card" } },
        },
      },
    },
  ];
  await receber("invoice.paid", { id: INV });
  await receber("invoice.payment_failed", { id: INV }); // atrasado
  const [f] = await admin.select().from(s.faturas).where(eq(s.faturas.tenantId, tenantId));
  expect(f).toMatchObject({ status: "paid", valorPago: 294, metodoPagamento: "cartao" });
  const t = await cliente();
  expect(t.status).toBe("ativo");
  expect(t.inadimplenteDesde).toBeNull();
  expect(t.suspensao).toBe("nenhuma");
});

test("estorno pela charge atualiza valor_estornado", async () => {
  estado.pagamentos = [
    {
      status: "paid",
      invoice: INV,
      payment: {
        payment_intent: {
          latest_charge: { amount_refunded: 9700, payment_method_details: { type: "card" } },
        },
      },
    },
  ];
  await receber("charge.refunded", { id: "ch_x", payment_intent: "pi_x" });
  const [f] = await admin.select().from(s.faturas).where(eq(s.faturas.tenantId, tenantId));
  expect(f!.valorEstornado).toBe(97);
});

test("cancelamento → cliente cancelado", async () => {
  estado.sub = { ...estado.sub, status: "canceled", canceled_at: agora };
  await receber("customer.subscription.deleted", { id: SUB });
  expect((await cliente()).status).toBe("cancelado");
});

test("statusDoCliente", () => {
  expect(statusDoCliente("trialing", "trial", false, "nenhuma")).toBe("trial");
  expect(statusDoCliente("past_due", "ativo", false, "parcial")).toBe("inadimplente");
  expect(statusDoCliente("unpaid", "inadimplente", true, "integral")).toBe("suspenso");
  expect(statusDoCliente("incomplete", "trial", false, "nenhuma")).toBe("trial");
  expect(statusDoCliente("active", "excluido", false, "nenhuma")).toBe("excluido");
  expect(statusDoCliente(null, "trial", false, "nenhuma")).toBe("trial");
});
