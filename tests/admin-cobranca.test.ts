/** Peças de cobrança usadas pelo Admin Master e pelo autoatendimento (Stripe falso). Banco local. */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { assinaturaBoleto, pixAtivo, sessaoCheckout } from "../src/server/billing/checkout";
import { dbAdmin, schema as s } from "../src/server/db";

const admin = dbAdmin();
let tenantId: string;
const chamadas: Record<string, unknown[]> = {};
const anotar = (nome: string, r: unknown) => async (p: unknown) => {
  (chamadas[nome] ??= []).push(p);
  return r;
};
const falso = {
  customers: { create: anotar("customer", { id: `cus_admin_${Date.now()}` }) },
  prices: { list: anotar("prices", { data: [{ id: "price_teste" }] }) },
  subscriptions: { create: anotar("sub", { id: "sub_x", status: "trialing" }) },
  checkout: { sessions: { create: anotar("checkout", { url: "https://checkout.stripe.com/x" }) } },
} as unknown as Stripe;
const ultima = (nome: string) => chamadas[nome]!.at(-1) as Record<string, unknown>;
const pix = (ativo: boolean) =>
  admin
    .insert(s.plataformaConfig)
    .values({ chave: "pix_ativo", valor: ativo })
    .onConflictDoUpdate({ target: s.plataformaConfig.chave, set: { valor: ativo } });

beforeAll(async () => {
  const [t] = await admin
    .insert(s.tenants)
    .values({
      razaoSocial: "Admin Cobrança Ltda",
      nomeFantasia: "Admin Cobrança",
      cnpj: "11222333000181",
    })
    .returning();
  tenantId = t!.id;
});

afterAll(async () => {
  await admin.delete(s.tenants).where(eq(s.tenants.id, tenantId));
});

test("boleto: send_invoice com prazo, trial no 1º uso do CNPJ e Customer criado uma vez", async () => {
  await pix(false);
  expect(await pixAtivo()).toBe(false);
  await assinaturaBoleto(falso, tenantId, "essencial", "anual", 10);
  expect(ultima("prices")).toMatchObject({ lookup_keys: ["concierge_essencial_anual"] });
  expect(ultima("sub")).toMatchObject({
    collection_method: "send_invoice",
    days_until_due: 10,
    trial_period_days: 7,
    payment_settings: { payment_method_types: ["boleto"] },
  });
  expect(ultima("customer")).toMatchObject({
    tax_id_data: [{ type: "br_cnpj", value: "11.222.333/0001-81" }],
  });
  // Customer já ligado ao cliente: não cria outro.
  await assinaturaBoleto(falso, tenantId, "essencial", "mensal", 7);
  expect(chamadas.customer!.length).toBe(1);
});

test("Pix entra nas faturas só com a chave ligada pelo admin", async () => {
  await pix(true);
  await assinaturaBoleto(falso, tenantId, "profissional", "mensal", 7);
  expect(ultima("sub")).toMatchObject({
    payment_settings: { payment_method_types: ["boleto", "pix"] },
  });
  await pix(false);
});

test("plano não vendável (trial) é recusado", async () => {
  await expect(assinaturaBoleto(falso, tenantId, "trial", "mensal", 7)).rejects.toThrow(
    "Plano não disponível",
  );
});

test("Checkout: cartão exigido e trial de 7 dias, ligado ao cliente", async () => {
  const r = await sessaoCheckout(falso, tenantId, "essencial", "mensal", "https://app.teste");
  expect(r).toEqual({ url: "https://checkout.stripe.com/x", semTrial: false });
  expect(ultima("checkout")).toMatchObject({
    mode: "subscription",
    client_reference_id: tenantId,
    payment_method_collection: "always",
    subscription_data: { trial_period_days: 7 },
    success_url: "https://app.teste/assinar?sessao={CHECKOUT_SESSION_ID}",
  });
});
