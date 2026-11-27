/**
 * Ferramentas do agente, uma por arquivo nesta pasta. Cliente, condomínio, morador e telefone
 * vêm SEMPRE do contexto da conversa (`Base`, closure), nunca do modelo: ele só informa o
 * conteúdo (texto, unidade, título…). Cada ferramenta grava na hora, na própria transação
 * (withTenant → RLS do cliente).
 */
import type { BetaRunnableTool } from "@anthropic-ai/sdk/lib/tools/BetaRunnableTool";
import { startActiveObservation } from "@langfuse/tracing";
import type { Contexto } from "@/server/agent/contexto";
import { schema as s, withTenant } from "@/server/db";
import { abrirDemanda } from "./abrir-demanda";
import { atualizarDemanda } from "./atualizar-demanda";
import { buscarRegras } from "./buscar-regras";
import { definirCondominio } from "./definir-condominio";
import { escalarSindico } from "./escalar-sindico";
import { identificarMorador } from "./identificar-morador";
import { minhasDemandas } from "./minhas-demandas";
import { LGPD_TEXTO, LGPD_TEXTO_EMAIL, registrarCadastro } from "./registrar-cadastro";

export {
  acharUnidade,
  LGPD_TEXTO,
  LGPD_TEXTO_EMAIL,
  LGPD_VERSAO,
  LGPD_VERSAO_EMAIL,
} from "./registrar-cadastro";

/** O que as ferramentas pedem para o fim da execução (run.ts decide o que fazer). */
export interface Efeitos {
  escalar: string | null;
  trocouCondominio: boolean;
}

/** O que toda ferramenta recebe, derivado só do contexto da conversa. */
export interface Base {
  ctx: Contexto;
  efeitos: Efeitos;
  tenantId: string;
  condominioId: string;
  /** Telefone (WhatsApp) ou e-mail do remetente. */
  endereco: string;
  email: boolean;
  telefone: string | null;
  lgpd: string;
  aprovado: boolean;
  visiveis: (typeof s.visibilidade.enumValues)[number][];
  tx: <T>(fn: Parameters<typeof withTenant<T>>[1]) => Promise<T>;
}

export function ferramentas(ctx: Contexto, efeitos: Efeitos) {
  const { tenantId } = ctx.conversa;
  const email = ctx.conversa.canal === "email";
  const aprovado = ctx.morador?.cadastro === "aprovado";
  const base: Base = {
    ctx,
    efeitos,
    tenantId,
    condominioId: ctx.conversa.condominioId!,
    endereco: ctx.conversa.endereco,
    email,
    telefone: email ? null : ctx.conversa.endereco,
    lgpd: email ? LGPD_TEXTO_EMAIL : LGPD_TEXTO,
    aprovado,
    visiveis: aprovado ? ["publico", "moradores"] : ["publico"],
    tx: (fn) => withTenant(tenantId, fn),
  };
  return [
    buscarRegras(base),
    definirCondominio(base),
    identificarMorador(base),
    registrarCadastro(base),
    abrirDemanda(base),
    minhasDemandas(base),
    atualizarDemanda(base),
    escalarSindico(base),
  ].map(rastreada);
}

/** Cada chamada vira uma observação "tool" no rastro do agente (Langfuse; sem ele, nada). */
function rastreada<T extends BetaRunnableTool>(t: T): T {
  return {
    ...t,
    run: (entrada, contexto) =>
      startActiveObservation(
        t.name,
        async (obs) => {
          obs.update({ input: entrada });
          const saida = await t.run(entrada, contexto);
          obs.update({ output: saida });
          return saida;
        },
        { asType: "tool" },
      ),
  };
}
