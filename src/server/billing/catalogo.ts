/**
 * Catálogo do Concierge no Stripe, montado a partir da tabela `planos`. A conta Stripe é dividida
 * com o OperaCondo Insights: tudo do Concierge leva o prefixo `concierge_` e `metadata.app`.
 *
 * Plano = um preço escalonado (graduated) por intervalo, com a quantidade igual ao número de
 * condomínios: o 1º degrau cobra os condomínios inclusos (valor fixo), o 2º cada adicional.
 */

export const APP = "operacondo-concierge";

export type Intervalo = "mensal" | "anual";
export const INTERVALOS: Intervalo[] = ["mensal", "anual"];

/** Anual = paga 10, leva 12. */
const MESES_COBRADOS: Record<Intervalo, number> = { mensal: 1, anual: 10 };
const STRIPE_INTERVALO = { mensal: "month", anual: "year" } as const;

export const produtoId = (item: string) => `concierge_${item}`;
export const lookupKey = (item: string, intervalo: Intervalo) => `concierge_${item}_${intervalo}`;

// ponytail: único adicional fora dos planos; vira tabela quando houver um segundo.
/** Repasse da Z-API (R$ 99,99) com Stripe e imposto, por número. */
export const WHATSAPP_GERENCIADO = {
  id: "whatsapp_gerenciado",
  nome: "WhatsApp gerenciado",
  precoMensal: 119,
};

export interface PlanoVendavel {
  id: string;
  nome: string;
  precoMensal: number;
  condominiosInclusos: number;
  precoCondominioAdicional: number | null;
}

/** Degrau no formato do Stripe: `up_to` null = infinito. Valores em centavos. */
export interface Degrau {
  up_to: number | null;
  flat_amount: number | null;
  unit_amount: number | null;
}

export interface PrecoDesejado {
  lookupKey: string;
  produto: string;
  intervalo: Intervalo;
  nickname: string;
  /** Plano: escalonado. Adicional: `unitAmount` por unidade. */
  degraus?: Degrau[];
  unitAmount?: number;
}

const centavos = (reais: number) => Math.round(reais * 100);

export function precosDoPlano(p: PlanoVendavel): PrecoDesejado[] {
  return INTERVALOS.map((intervalo) => {
    const m = MESES_COBRADOS[intervalo];
    const inclusos: Degrau = {
      up_to: p.precoCondominioAdicional == null ? null : p.condominiosInclusos,
      flat_amount: centavos(p.precoMensal * m),
      unit_amount: null,
    };
    const degraus =
      p.precoCondominioAdicional == null
        ? [inclusos]
        : [
            inclusos,
            {
              up_to: null,
              flat_amount: null,
              unit_amount: centavos(p.precoCondominioAdicional * m),
            },
          ];
    return {
      lookupKey: lookupKey(p.id, intervalo),
      produto: produtoId(p.id),
      intervalo,
      nickname: `${p.nome} ${intervalo}`,
      degraus,
    };
  });
}

export function precosDoAdicional(a = WHATSAPP_GERENCIADO): PrecoDesejado[] {
  return INTERVALOS.map((intervalo) => ({
    lookupKey: lookupKey(a.id, intervalo),
    produto: produtoId(a.id),
    intervalo,
    nickname: `${a.nome} ${intervalo}`,
    unitAmount: centavos(a.precoMensal * MESES_COBRADOS[intervalo]),
  }));
}

/** Valor de um período para N condomínios (centavos), como o Stripe calcula no graduated. */
export function valorDosDegraus(degraus: Degrau[], quantidade: number): number {
  let total = 0;
  let anterior = 0;
  for (const d of degraus) {
    if (quantidade <= anterior) break;
    const ate = d.up_to ?? Infinity;
    total += (d.flat_amount ?? 0) + (d.unit_amount ?? 0) * (Math.min(quantidade, ate) - anterior);
    anterior = ate;
  }
  return total;
}

/** O que o Stripe devolve de um preço (só os campos comparados). */
export interface PrecoStripe {
  currency: string;
  billing_scheme: string;
  tiers_mode?: string | null;
  unit_amount: number | null;
  recurring: { interval: string; interval_count: number } | null;
  tiers?: Degrau[] | null;
}

/** Preço é imutável no Stripe: se mudou, o seed cria outro e transfere o lookup_key. */
export function mesmoPreco(atual: PrecoStripe, d: PrecoDesejado): boolean {
  if (atual.currency !== "brl") return false;
  if (
    atual.recurring?.interval !== STRIPE_INTERVALO[d.intervalo] ||
    atual.recurring.interval_count !== 1
  )
    return false;
  if (d.degraus) {
    const t = atual.tiers ?? [];
    return (
      atual.billing_scheme === "tiered" &&
      atual.tiers_mode === "graduated" &&
      t.length === d.degraus.length &&
      d.degraus.every(
        (g, i) =>
          (t[i].up_to ?? null) === g.up_to &&
          (t[i].flat_amount ?? 0) === (g.flat_amount ?? 0) &&
          (t[i].unit_amount ?? 0) === (g.unit_amount ?? 0),
      )
    );
  }
  return atual.billing_scheme === "per_unit" && atual.unit_amount === d.unitAmount;
}

/** Parâmetros de criação do preço no Stripe. */
export function paramsDoPreco(d: PrecoDesejado) {
  const base = {
    currency: "brl",
    product: d.produto,
    lookup_key: d.lookupKey,
    transfer_lookup_key: true,
    nickname: d.nickname,
    recurring: { interval: STRIPE_INTERVALO[d.intervalo], interval_count: 1 },
    metadata: { app: APP },
  };
  if (!d.degraus) return { ...base, unit_amount: d.unitAmount };
  return {
    ...base,
    billing_scheme: "tiered" as const,
    tiers_mode: "graduated" as const,
    tiers: d.degraus.map((g) => ({
      up_to: g.up_to ?? ("inf" as const),
      ...(g.flat_amount != null ? { flat_amount: g.flat_amount } : {}),
      ...(g.unit_amount != null ? { unit_amount: g.unit_amount } : {}),
    })),
  };
}
