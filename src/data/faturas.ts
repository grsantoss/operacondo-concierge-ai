import { queryOptions, useQuery } from "@tanstack/react-query";
import { statusStripe } from "@/lib/admin-cobranca.functions";
import { listarFaturas } from "@/lib/admin.functions";

/** Como a tela mostra a fatura. Vem do status do Stripe: "vencida" = open com vencimento passado. */
export type FaturaStatus = "paid" | "open" | "past_due" | "void" | "refunded";

export interface Fatura {
  id: string;
  tenantId: string;
  numero: string;
  valor: number;
  status: FaturaStatus;
  periodo: string; // "2026-07"
  emissao: string; // yyyy-mm-dd
  vencimento: string;
  stripeInvoiceId: string;
  metodo: string;
  urlFatura: string;
  nfseNumero: string;
  nfseEmitidaEm: string;
}

export const faturasQuery = queryOptions({
  queryKey: ["admin", "faturas"],
  queryFn: () => listarFaturas(),
});

export function useFaturas(): Fatura[] {
  return useQuery(faturasQuery).data ?? [];
}

export const STATUS_LABEL: Record<FaturaStatus, string> = {
  paid: "Paga",
  open: "Em aberto",
  past_due: "Vencida",
  void: "Cancelada",
  refunded: "Estornada",
};

export const STATUS_TONE: Record<FaturaStatus, string> = {
  paid: "bg-[var(--color-success-soft)] text-[var(--color-success-strong)]",
  open: "bg-[var(--color-info-soft)] text-[var(--color-brand)]",
  past_due: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  void: "bg-[var(--color-surface-mid)] text-[var(--color-on-surface-variant)]",
  refunded: "bg-[var(--color-warning-soft)] text-[var(--color-warning-strong)]",
};

export function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Card do Stripe no financeiro: modo, conta, último webhook e Pix. */
export const statusStripeQuery = queryOptions({
  queryKey: ["admin", "stripe"],
  queryFn: () => statusStripe(),
});
