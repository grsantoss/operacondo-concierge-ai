import Stripe from "stripe";

/** Versão da API fixada junto com o SDK (`stripe` 23.1.0, sem `^`). Atualizar os dois juntos. */
export const STRIPE_API_VERSION = "2026-10-28.endive";

let cliente: Stripe | undefined;

export const stripeConfigurado = () => Boolean(process.env.STRIPE_SECRET_KEY);

/** Cliente do Stripe. Chave só por variável (`STRIPE_SECRET_KEY`); preferir restricted key. */
export function stripe(): Stripe {
  const chave = process.env.STRIPE_SECRET_KEY;
  if (!chave) throw new Error("STRIPE_SECRET_KEY não configurada");
  cliente ??= new Stripe(chave, {
    apiVersion: STRIPE_API_VERSION,
    appInfo: { name: "operacondo-concierge" },
  });
  return cliente;
}

/** Chave de produção (sk_live_/rk_live_). */
export const chaveDeProducao = (chave = process.env.STRIPE_SECRET_KEY ?? "") =>
  /^(sk|rk)_live_/.test(chave);
