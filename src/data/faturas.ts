import { useEffect, useState } from "react";

export type FaturaStatus = "paid" | "open" | "past_due" | "void" | "refunded";

export interface Fatura {
  id: string;
  tenantId: string;
  valor: number;
  status: FaturaStatus;
  periodo: string; // "2026-07"
  emissao: string; // yyyy-mm-dd
  vencimento: string;
  stripeInvoiceId: string;
  metodo: "card" | "boleto" | "pix";
}

const FATURAS: Fatura[] = [
  { id: "f1", tenantId: "t1", valor: 699, status: "paid", periodo: "2026-07", emissao: "2026-07-01", vencimento: "2026-07-10", stripeInvoiceId: "in_aur_07", metodo: "card" },
  { id: "f2", tenantId: "t1", valor: 699, status: "paid", periodo: "2026-06", emissao: "2026-06-01", vencimento: "2026-06-10", stripeInvoiceId: "in_aur_06", metodo: "card" },
  { id: "f3", tenantId: "t2", valor: 1899, status: "paid", periodo: "2026-07", emissao: "2026-07-01", vencimento: "2026-07-10", stripeInvoiceId: "in_vv_07", metodo: "boleto" },
  { id: "f4", tenantId: "t2", valor: 1899, status: "open", periodo: "2026-08", emissao: "2026-08-01", vencimento: "2026-08-10", stripeInvoiceId: "in_vv_08", metodo: "boleto" },
  { id: "f5", tenantId: "t4", valor: 699, status: "past_due", periodo: "2026-06", emissao: "2026-06-01", vencimento: "2026-06-10", stripeInvoiceId: "in_sol_06", metodo: "card" },
  { id: "f6", tenantId: "t5", valor: 699, status: "paid", periodo: "2026-07", emissao: "2026-07-01", vencimento: "2026-07-10", stripeInvoiceId: "in_col_07", metodo: "pix" },
  { id: "f7", tenantId: "t5", valor: 699, status: "paid", periodo: "2026-06", emissao: "2026-06-01", vencimento: "2026-06-10", stripeInvoiceId: "in_col_06", metodo: "pix" },
  { id: "f8", tenantId: "t1", valor: 699, status: "refunded", periodo: "2026-05", emissao: "2026-05-01", vencimento: "2026-05-10", stripeInvoiceId: "in_aur_05", metodo: "card" },
];

type L = () => void;
const listeners = new Set<L>();
const emit = () => listeners.forEach((l) => l());

export function useFaturas() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return FATURAS;
}

export function listFaturas() {
  return FATURAS;
}

export function updateFaturaStatus(id: string, status: FaturaStatus) {
  const f = FATURAS.find((x) => x.id === id);
  if (f) {
    f.status = status;
    emit();
  }
}

export const STATUS_LABEL: Record<FaturaStatus, string> = {
  paid: "Paga",
  open: "Em aberto",
  past_due: "Vencida",
  void: "Cancelada",
  refunded: "Estornada",
};

export const STATUS_TONE: Record<FaturaStatus, string> = {
  paid: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  open: "bg-[var(--color-info-soft)] text-[var(--color-brand)]",
  past_due: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  void: "bg-[var(--color-surface-mid)] text-[var(--color-on-surface-variant)]",
  refunded: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
};

export function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
