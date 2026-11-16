/**
 * Escala de urgência única para demandas e conversas (CLAUDE.md, decisões de 13/11/2026):
 * Crítica → destructive, Alta → atenção, Normal → neutro.
 */
import type { Priority } from "@/data/demandas";

const ORDEM: Record<Priority, number> = { Normal: 0, Alta: 1, Crítica: 2 };

/** A conversa assume a maior urgência entre a triagem dela e as demandas abertas. */
export function maiorPrioridade(triagem: Priority, ...demandasAbertas: Priority[]): Priority {
  return demandasAbertas.reduce((m, p) => (ORDEM[p] > ORDEM[m] ? p : m), triagem);
}

export const URGENCIA: Record<Priority, { ring: string; bg: string; text: string; dot: string }> = {
  Crítica: {
    ring: "ring-destructive/30",
    bg: "bg-destructive/10",
    text: "text-destructive",
    dot: "bg-destructive",
  },
  Alta: {
    ring: "ring-warning/40",
    bg: "bg-warning-soft",
    text: "text-warning-strong",
    dot: "bg-warning",
  },
  Normal: {
    ring: "ring-border",
    bg: "bg-muted",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};
