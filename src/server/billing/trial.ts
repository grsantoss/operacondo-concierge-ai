/**
 * Um trial por CNPJ, por número de WhatsApp e por cartão. Quem repete continua podendo assinar,
 * mas sem os 7 dias grátis: o Checkout nasce sem trial, ou o trial em curso é encerrado no Stripe
 * (cobra o 1º período na hora).
 */
import { and, desc, eq } from "drizzle-orm";
import type Stripe from "stripe";
import { hashSegredo } from "@/server/cripto";
import { dbAdmin, schema as s } from "@/server/db";
import { stripe, stripeConfigurado } from "./stripe";

export type UsoTrial = ["cnpj" | "whatsapp" | "cartao", string];

/** Registra os valores para o cliente; devolve true se algum já deu trial a outro cliente. */
export async function trialRepetido(tenantId: string, usos: UsoTrial[]): Promise<boolean> {
  const db = dbAdmin();
  let repetido = false;
  for (const [tipo, valor] of usos) {
    const valorHash = hashSegredo(`${tipo}:${valor}`);
    await db.insert(s.trialUsos).values({ tipo, valorHash, tenantId }).onConflictDoNothing();
    const [u] = await db
      .select({ tenantId: s.trialUsos.tenantId })
      .from(s.trialUsos)
      .where(and(eq(s.trialUsos.tipo, tipo), eq(s.trialUsos.valorHash, valorHash)));
    if (u && u.tenantId !== tenantId) repetido = true;
  }
  return repetido;
}

/** Só consulta (antes do Checkout): o valor já deu trial a outro cliente? */
export async function trialJaUsado(tenantId: string, usos: UsoTrial[]): Promise<boolean> {
  const db = dbAdmin();
  for (const [tipo, valor] of usos) {
    const [u] = await db
      .select({ tenantId: s.trialUsos.tenantId })
      .from(s.trialUsos)
      .where(
        and(eq(s.trialUsos.tipo, tipo), eq(s.trialUsos.valorHash, hashSegredo(`${tipo}:${valor}`))),
      );
    if (u && u.tenantId !== tenantId) return true;
  }
  return false;
}

/**
 * Registra os usos e, se o cliente está em trial com algum valor repetido, encerra o trial agora.
 * Os webhooks seguintes (assinatura e fatura) atualizam o espelho.
 */
export async function aplicarTrialUnico(
  tenantId: string,
  usos: UsoTrial[],
  st?: Stripe,
): Promise<boolean> {
  const [a] = await dbAdmin()
    .select({ sub: s.assinaturas.stripeSubscriptionId, status: s.assinaturas.status })
    .from(s.assinaturas)
    .where(eq(s.assinaturas.tenantId, tenantId))
    .orderBy(desc(s.assinaturas.criadoEm))
    .limit(1);
  if (a?.status !== "trialing" || !a.sub) return false;
  if (!(await trialRepetido(tenantId, usos))) return false;
  if (!st && !stripeConfigurado()) return false;
  await (st ?? stripe()).subscriptions.update(a.sub, {
    trial_end: "now",
    proration_behavior: "none",
  });
  return true;
}
