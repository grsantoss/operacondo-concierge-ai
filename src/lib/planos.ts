/** Planos na tela pública: preço, escolha na URL e mensagem de erro (/planos, /cadastro, /assinar). */
import { erroAmigavel } from "@/lib/utils";

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const num = (v: number) => v.toLocaleString("pt-BR");

/** Preço do intervalo (anual = 10 × mensal). */
export const precoNoIntervalo = (mensal: number, intervalo: "mensal" | "anual") =>
  intervalo === "anual" ? mensal * 10 : mensal;

export interface Escolha {
  plano?: string;
  intervalo?: "mensal" | "anual";
}

export const escolhaDaUrl = (s: Record<string, unknown>): Escolha => ({
  plano: typeof s.plano === "string" && s.plano ? s.plano : undefined,
  intervalo: s.intervalo === "anual" ? "anual" : s.intervalo === "mensal" ? "mensal" : undefined,
});

export const mensagem = (err: unknown) =>
  err instanceof Error ? erroAmigavel(err) : "Não foi possível concluir. Tente de novo.";
