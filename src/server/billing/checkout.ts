/**
 * Peças comuns ao autoatendimento e ao Admin Master: Customer do Stripe, preço pelo lookup_key,
 * Checkout com trial e assinatura por boleto. O banco só muda pelo espelho (`sync.ts`).
 */
import { getRequestUrl } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { APP, lookupKey } from "@/server/billing/catalogo";
import { trialJaUsado } from "@/server/billing/trial";
import { dbAdmin, schema as s } from "@/server/db";

export const TRIAL_DIAS = 7;

/** Base das URLs de volta do Stripe: `APP_URL` ou a origem do pedido. */
export function urlBase(): string {
  return (process.env.APP_URL || getRequestUrl().origin).replace(/\/+$/, "");
}
export type Intervalo = "mensal" | "anual";

const formatarCnpj = (v: string) =>
  v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

/** Customer do cliente no Stripe (cria na 1ª vez, com CNPJ como `br_cnpj`). */
export async function garantirCustomer(st: Stripe, tenantId: string): Promise<string> {
  const db = dbAdmin();
  const [t] = await db.select().from(s.tenants).where(eq(s.tenants.id, tenantId));
  if (!t) throw new Error("Cliente não encontrado.");
  if (t.stripeCustomerId) return t.stripeCustomerId;
  const novo = await st.customers.create(
    {
      name: t.razaoSocial,
      email: t.email ?? undefined,
      phone: t.telefone ?? undefined,
      metadata: { app: APP, tenant_id: t.id },
      ...(t.cnpj ? { tax_id_data: [{ type: "br_cnpj", value: formatarCnpj(t.cnpj) }] } : {}),
    },
    { idempotencyKey: `concierge-cliente-${t.id}` },
  );
  await db.update(s.tenants).set({ stripeCustomerId: novo.id }).where(eq(s.tenants.id, t.id));
  return novo.id;
}

export async function precoDoPlano(st: Stripe, planoId: string, intervalo: Intervalo) {
  const precos = await st.prices.list({
    lookup_keys: [lookupKey(planoId, intervalo)],
    active: true,
    limit: 1,
  });
  const preco = precos.data[0];
  if (!preco)
    throw new Error("Preço do plano não encontrado no Stripe (rode bun run stripe:seed).");
  return preco.id;
}

/** Plano vendável e ativo, ou erro. */
export async function planoVendavel(planoId: string) {
  const [p] = await dbAdmin().select().from(s.planos).where(eq(s.planos.id, planoId));
  if (!p?.vendavel || !p.ativo) throw new Error("Plano não disponível.");
  return p;
}

/** Trial só se o CNPJ ainda não teve (WhatsApp e cartão são conferidos no espelho). */
async function comTrial(tenantId: string) {
  const [t] = await dbAdmin()
    .select({ cnpj: s.tenants.cnpj })
    .from(s.tenants)
    .where(eq(s.tenants.id, tenantId));
  return !(t?.cnpj && (await trialJaUsado(tenantId, [["cnpj", t.cnpj]])));
}

/** Pix nas faturas enviadas (boleto e avulsa): só com `pix_ativo` ligado pelo Admin Master. */
export async function pixAtivo(): Promise<boolean> {
  const [c] = await dbAdmin()
    .select({ valor: s.plataformaConfig.valor })
    .from(s.plataformaConfig)
    .where(eq(s.plataformaConfig.chave, "pix_ativo"));
  return c?.valor === true;
}

export async function metodosFatura(): Promise<("boleto" | "pix")[]> {
  return (await pixAtivo()) ? ["boleto", "pix"] : ["boleto"];
}

/** Stripe Checkout da assinatura (cartão exigido, trial de 7 dias quando permitido). */
export async function sessaoCheckout(
  st: Stripe,
  tenantId: string,
  planoId: string,
  intervalo: Intervalo,
  base: string,
) {
  const plano = await planoVendavel(planoId);
  const customer = await garantirCustomer(st, tenantId);
  const preco = await precoDoPlano(st, plano.id, intervalo);
  const semTrial = !(await comTrial(tenantId));
  const sessao = await st.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: tenantId,
    line_items: [{ price: preco, quantity: 1 }],
    payment_method_collection: "always",
    locale: "pt-BR",
    metadata: { app: APP, tenant_id: tenantId },
    subscription_data: {
      metadata: { app: APP, tenant_id: tenantId },
      ...(semTrial
        ? {}
        : {
            trial_period_days: TRIAL_DIAS,
            trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
          }),
    },
    success_url: `${base}/assinar?sessao={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/assinar?plano=${plano.id}&intervalo=${intervalo}`,
  });
  if (!sessao.url) throw new Error("O Stripe não devolveu o endereço do pagamento.");
  return { url: sessao.url, semTrial };
}

/** Assinatura por boleto (fatura enviada por e-mail pelo Stripe), com trial quando permitido. */
export async function assinaturaBoleto(
  st: Stripe,
  tenantId: string,
  planoId: string,
  intervalo: Intervalo,
  diasParaPagar: number,
) {
  const plano = await planoVendavel(planoId);
  const customer = await garantirCustomer(st, tenantId);
  const preco = await precoDoPlano(st, plano.id, intervalo);
  return st.subscriptions.create({
    customer,
    items: [{ price: preco, quantity: 1 }],
    collection_method: "send_invoice",
    days_until_due: diasParaPagar,
    payment_settings: { payment_method_types: await metodosFatura() },
    metadata: { app: APP, tenant_id: tenantId },
    ...((await comTrial(tenantId)) ? { trial_period_days: TRIAL_DIAS } : {}),
  });
}
