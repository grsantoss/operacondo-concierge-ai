import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Erro de validação do zod chega como JSON; mostra só as mensagens. */
export function erroAmigavel(err: unknown): string {
  const m = (err as Error).message;
  try {
    const lista = JSON.parse(m) as { message: string }[];
    if (Array.isArray(lista)) return lista.map((x) => x.message).join(" ");
  } catch {
    /* mensagem comum */
  }
  return m;
}
