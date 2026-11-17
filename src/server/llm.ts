/** Modelo e custo das chamadas ao Claude (fonte da cobrança: `llm_execucoes`). */
import type Anthropic from "@anthropic-ai/sdk";

export const HAIKU = "claude-haiku-5-5";

// US$ por milhão de tokens, Haiku 5.5 com prompt até 100 mil tokens. Cache: leitura 0,1×,
// gravação 1,25× da entrada. ponytail: tabela de um modelo só; acima de 100 mil tokens o preço
// dobra (o contexto do agente fica abaixo disso, ver agent/contexto.ts).
const PRECO = { entrada: 0.1, saida: 0.5 };

export function uso(r: Pick<Anthropic.Message, "usage">, modelo: string, inicio: number) {
  const u = r.usage;
  const cacheLido = u.cache_read_input_tokens ?? 0;
  const cacheGravado = u.cache_creation_input_tokens ?? 0;
  const custo =
    (u.input_tokens * PRECO.entrada +
      cacheGravado * PRECO.entrada * 1.25 +
      cacheLido * PRECO.entrada * 0.1 +
      u.output_tokens * PRECO.saida) /
    1e6;
  return {
    modelo,
    tokensEntrada: u.input_tokens + cacheGravado,
    tokensSaida: u.output_tokens,
    tokensCache: cacheLido,
    custoUsd: custo,
    latenciaMs: Date.now() - inicio,
  };
}

export const iaConfigurada = () => !!process.env.ANTHROPIC_API_KEY;
