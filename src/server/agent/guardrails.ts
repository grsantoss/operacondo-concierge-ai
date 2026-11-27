/**
 * Guarda-corpos da saída do agente: o que não pode ir ao morador como resposta da IA e vai ao
 * síndico, com o motivo e, quando houver, o rascunho (#24, #102). Sem banco: run.ts aplica.
 */
import type { BetaMessage } from "@anthropic-ai/sdk/resources/beta";
import { SEM_BASE } from "@/server/agent/prompt";
import { ATENDIMENTO_INDISPONIVEL } from "@/server/billing/limites";

export const AVISO_SINDICO =
  "Recebi sua mensagem e encaminhei ao síndico, que responde por aqui em breve.";

/** Respostas fixas do sistema: saem como `autor = sistema` e nunca viram rascunho no e-mail. */
export const FIXAS = new Set([AVISO_SINDICO, ATENDIMENTO_INDISPONIVEL]);

/** Resposta sem base documental, recusada ou cortada → síndico. `null`: pode seguir. */
export function paraOSindico(
  r: BetaMessage,
  texto: string,
): { motivo: string; rascunho: string | null } | null {
  const semBase = texto.startsWith(SEM_BASE);
  // max_tokens, ou acabaram as rodadas ainda pedindo ferramenta.
  const cortada = r.stop_reason === "max_tokens" || r.stop_reason === "tool_use";
  if (!texto || semBase || cortada || r.stop_reason === "refusal")
    return {
      motivo:
        r.stop_reason === "refusal"
          ? "A IA recusou responder"
          : cortada
            ? "A IA não concluiu a resposta"
            : "Sem base documental",
      rascunho: semBase ? texto.slice(SEM_BASE.length).trim() || null : null,
    };
  return null;
}
