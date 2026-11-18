/** Autoatendimento: CNPJ e antiabuso do trial. Precisa do banco local. */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { inArray } from "drizzle-orm";
import type Stripe from "stripe";
import { cnpjValido } from "../src/lib/cobranca.functions";
import { sincronizarAssinatura } from "../src/server/billing/sync";
import { trialJaUsado, trialRepetido } from "../src/server/billing/trial";
import { inserirCliente } from "../src/server/clientes";
import { dbAdmin, schema as s } from "../src/server/db";

const admin = dbAdmin();
const sufixo = Date.now().toString(36);
// CNPJs de teste com dígitos verificadores válidos, gerados por sufixo para não colidir.
function cnpjCom(base12: string) {
  for (let d = 0; d < 100; d++) {
    const c = base12 + String(d).padStart(2, "0");
    if (cnpjValido(c)) return c;
  }
  throw new Error("sem DV");
}
const base = String(Date.now()).slice(-8);
const CNPJ_A = cnpjCom(`${base}0001`);
const CNPJ_B = cnpjCom(`${base}0002`);
let A: string;
let B: string;
const atualizados: { id: string; params: unknown }[] = [];

const sub = (id: string, customer: string, fingerprint: string) => ({
  id,
  customer,
  status: "trialing",
  collection_method: "charge_automatically",
  default_payment_method: { card: { fingerprint } },
  trial_end: Math.floor(Date.now() / 1000) + 7 * 86400,
  cancel_at_period_end: false,
  canceled_at: null,
  latest_invoice: null,
  items: {
    data: [
      {
        quantity: 1,
        current_period_start: 1,
        current_period_end: 2,
        price: { lookup_key: "concierge_essencial_mensal" },
      },
    ],
  },
});
const falso = (assinatura: ReturnType<typeof sub>) =>
  ({
    subscriptions: {
      retrieve: async () => assinatura,
      update: async (id: string, params: unknown) => {
        atualizados.push({ id, params });
        return {};
      },
    },
  }) as unknown as Stripe;

beforeAll(async () => {
  const criar = (cnpj: string, n: string) =>
    admin.transaction((tx) =>
      inserirCliente(
        tx,
        {
          razaoSocial: `Trial ${n}`,
          nomeFantasia: `Trial ${n}`,
          cnpj,
          stripeCustomerId: `cus_trial_${n}_${sufixo}`,
        },
        {
          nome: `Síndico ${n}`,
          email: `trial-${n}-${sufixo}@teste.local`,
          senha: "senha-teste-123",
        },
      ),
    );
  A = await criar(CNPJ_A, "a");
  B = await criar(CNPJ_B, "b");
});

afterAll(async () => {
  const ids = [A, B];
  await admin.delete(s.trialUsos).where(inArray(s.trialUsos.tenantId, ids));
  await admin.delete(s.assinaturas).where(inArray(s.assinaturas.tenantId, ids));
  const membros = await admin
    .delete(s.membros)
    .where(inArray(s.membros.tenantId, ids))
    .returning({ userId: s.membros.userId });
  const users = membros.map((m) => m.userId);
  await admin.delete(s.account).where(inArray(s.account.userId, users));
  await admin.delete(s.user).where(inArray(s.user.id, users));
  await admin.delete(s.tenants).where(inArray(s.tenants.id, ids));
});

test("CNPJ: dígitos verificadores", () => {
  expect(cnpjValido("11222333000181")).toBe(true);
  expect(cnpjValido("11222333000182")).toBe(false);
  expect(cnpjValido("11111111111111")).toBe(false);
  expect(cnpjValido("1122233300018")).toBe(false);
});

test("o mesmo cliente pode repetir o próprio valor; outro cliente, não", async () => {
  expect(await trialRepetido(A, [["whatsapp", `+55119${sufixo}`]])).toBe(false);
  expect(await trialRepetido(A, [["whatsapp", `+55119${sufixo}`]])).toBe(false);
  expect(await trialJaUsado(B, [["whatsapp", `+55119${sufixo}`]])).toBe(true);
  expect(await trialRepetido(B, [["whatsapp", `+55119${sufixo}`]])).toBe(true);
});

test("1º trial com o cartão segue; 2º cliente com o mesmo cartão tem o trial encerrado", async () => {
  const fp = `fp_${sufixo}`;
  await sincronizarAssinatura(
    `sub_a_${sufixo}`,
    falso(sub(`sub_a_${sufixo}`, `cus_trial_a_${sufixo}`, fp)),
  );
  expect(atualizados).toHaveLength(0);
  await sincronizarAssinatura(
    `sub_b_${sufixo}`,
    falso(sub(`sub_b_${sufixo}`, `cus_trial_b_${sufixo}`, fp)),
  );
  expect(atualizados).toEqual([
    { id: `sub_b_${sufixo}`, params: { trial_end: "now", proration_behavior: "none" } },
  ]);
});

test("CNPJ do cliente entra no registro ao começar o trial", async () => {
  expect(await trialJaUsado(B, [["cnpj", CNPJ_A]])).toBe(true);
  expect(await trialJaUsado(A, [["cnpj", CNPJ_A]])).toBe(false);
});
