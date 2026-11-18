/**
 * `POST /api/stripe/webhook`: corpo cru + assinatura (`STRIPE_WEBHOOK_SECRET`) → `stripe_eventos`
 * (idempotente pelo id do evento) → 200 → fila `stripe`. Nada é processado aqui: o worker busca
 * o objeto atual na API, porque os eventos chegam fora de ordem.
 */
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { dbAdmin, schema as s } from "@/server/db";
import { enfileirarStripe } from "@/server/queue";

/** Eventos que o Concierge espelha (os demais recebem 200 e são descartados). */
export const EVENTOS_STRIPE = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "invoice.finalized",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.voided",
  "invoice.marked_uncollectible",
  "charge.refunded",
  "customer.updated",
]);

const resposta = (status: number, corpo: object) => Response.json(corpo, { status });

export async function receberWebhookStripe(request: Request): Promise<Response> {
  const segredo = process.env.STRIPE_WEBHOOK_SECRET;
  if (!segredo) return resposta(503, { erro: "Stripe não configurado" });
  const assinatura = request.headers.get("stripe-signature");
  if (!assinatura) return resposta(400, { erro: "Sem assinatura" });

  const corpo = await request.text();
  let evento: Stripe.Event;
  try {
    evento = await Stripe.webhooks.constructEventAsync(corpo, assinatura, segredo);
  } catch {
    return resposta(400, { erro: "Assinatura inválida" });
  }
  if (!EVENTOS_STRIPE.has(evento.type)) return resposta(200, { ignorado: true });

  const db = dbAdmin();
  await db
    .insert(s.stripeEventos)
    .values({ eventId: evento.id, tipo: evento.type, payload: evento })
    .onConflictDoNothing();
  // Reenvio do Stripe depois de uma falha ao enfileirar: enfileira de novo se ainda não processou.
  const [e] = await db
    .select({ processadoEm: s.stripeEventos.processadoEm })
    .from(s.stripeEventos)
    .where(eq(s.stripeEventos.eventId, evento.id));
  if (!e?.processadoEm) await enfileirarStripe({ eventId: evento.id });
  return resposta(200, { recebido: true });
}
