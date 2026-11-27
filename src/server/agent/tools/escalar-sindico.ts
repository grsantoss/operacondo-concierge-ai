/** Ferramenta `escalar_sindico`. */
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Base } from "./index";

export function escalarSindico({ efeitos }: Base) {
  return betaZodTool({
    name: "escalar_sindico",
    description:
      "Passa a conversa para o síndico (reclamação entre vizinhos, pedido de exceção, assunto sensível, morador pediu para falar com o síndico). Depois avise o morador que o síndico responde por aqui.",
    inputSchema: z.object({ motivo: z.string().min(3).max(300) }),
    run: async ({ motivo }) => {
      efeitos.escalar = motivo;
      return "Conversa será passada ao síndico. Escreva ao morador uma mensagem curta avisando.";
    },
  });
}
