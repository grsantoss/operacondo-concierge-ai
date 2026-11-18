/**
 * Limites que valem para o cliente agora. Durante o trial valem os do plano interno `trial`
 * (totais); fora dele, os do plano contratado multiplicados pelos condomínios da assinatura.
 */
import { desc, eq, sql } from "drizzle-orm";
import { schema as s, type Tx } from "@/server/db";

type Plano = typeof s.planos.$inferSelect;

export interface Limites {
  condominios: number;
  moradores: number;
  documentos: number;
  respostasIaMes: number;
  /** Teto técnico de custo de IA no mês, em R$. */
  tetoCustoIaMes: number;
  usaConselheiro: boolean;
}

export function calcularLimites(plano: Plano, quantidade: number, trial: Plano | null): Limites {
  if (trial) {
    return {
      condominios: trial.limiteCondominios,
      moradores: trial.limiteMoradores,
      documentos: trial.limiteDocumentos,
      respostasIaMes: trial.limiteRespostasIaMes,
      tetoCustoIaMes: Number(trial.tetoCustoIaMes),
      usaConselheiro: trial.usaConselheiro,
    };
  }
  // O 1º degrau do preço cobre os inclusos: 3 condomínios no Profissional ainda dão direito a 5.
  const q = Math.min(Math.max(quantidade, plano.condominiosInclusos, 1), plano.limiteCondominios);
  return {
    condominios: q,
    moradores: plano.limiteMoradores * q,
    documentos: plano.limiteDocumentos * q,
    respostasIaMes: plano.limiteRespostasIaMes * q,
    tetoCustoIaMes: Number(plano.tetoCustoIaMes) * q,
    usaConselheiro: plano.usaConselheiro,
  };
}

/** Assinatura mais recente do cliente (a que vale), com o plano e os limites. Dentro de `withTenant`. */
export async function assinaturaAtual(tx: Tx) {
  const [a] = await tx.select().from(s.assinaturas).orderBy(desc(s.assinaturas.criadoEm)).limit(1);
  if (!a) return null;
  const ids = a.status === "trialing" ? [a.planoId, "trial"] : [a.planoId];
  const planos = await Promise.all(
    ids.map((id) => tx.select().from(s.planos).where(eq(s.planos.id, id))),
  );
  const plano = planos[0]![0];
  if (!plano) return null;
  const trial = planos[1]?.[0] ?? null;
  return { assinatura: a, plano, limites: calcularLimites(plano, a.quantidadeCondominios, trial) };
}

export interface Uso {
  condominios: number;
  moradores: number;
  documentos: number;
  respostasIa: number;
  custoIaUsd: number;
}

/** Uso do mês do cliente (view `uso_mensal`). Dentro de `withTenant`. */
export async function usoMensal(tx: Tx): Promise<Uso> {
  const {
    rows: [u],
  } = await tx.execute<Record<string, string>>(
    sql`select condominios, moradores, documentos, respostas_ia, custo_ia_usd from uso_mensal`,
  );
  return {
    condominios: Number(u?.condominios ?? 0),
    moradores: Number(u?.moradores ?? 0),
    documentos: Number(u?.documentos ?? 0),
    respostasIa: Number(u?.respostas_ia ?? 0),
    custoIaUsd: Number(u?.custo_ia_usd ?? 0),
  };
}

/** ponytail: câmbio fixo por variável; trocar por cotação diária se o teto ficar apertado. */
const USD_BRL = Number(process.env.USD_BRL || 5.5);

/** Suspensão por inadimplência do cliente (job diário). Dentro de `withTenant`. */
export async function suspensaoDo(tx: Tx) {
  const [t] = await tx.select({ suspensao: s.tenants.suspensao }).from(s.tenants);
  return t?.suspensao ?? "nenhuma";
}

/** Resposta fixa do WhatsApp com a conta congelada (D+10), sem IA. */
export const ATENDIMENTO_INDISPONIVEL =
  "No momento o atendimento por aqui está indisponível. Procure a administração do condomínio.";

/** A partir de quanto do limite de respostas o síndico é avisado. */
export const AVISO_USO = 0.8;

/** IA liberada se as respostas do mês e o custo (teto técnico) estão abaixo do limite. */
export function iaNoLimite(uso: Uso, l: Limites): string | null {
  if (uso.respostasIa >= l.respostasIaMes) return "Limite de respostas da IA do mês atingido";
  if (uso.custoIaUsd * USD_BRL >= l.tetoCustoIaMes) return "Teto de custo da IA do mês atingido";
  return null;
}

const NOMES = {
  moradores: "moradores",
  documentos: "documentos na base",
  condominios: "condomínios",
};

/**
 * Bloqueia o cadastro que passaria do limite do plano. Sem assinatura (cliente de avaliação
 * ou criado à mão antes da cobrança) não há limite.
 */
export async function exigirLimite(tx: Tx, recurso: keyof typeof NOMES, novos = 1): Promise<void> {
  const atual = await assinaturaAtual(tx);
  if (!atual) return;
  const uso = await usoMensal(tx);
  const limite = atual.limites[recurso];
  if (uso[recurso] + novos > limite)
    throw new Error(
      `O plano permite até ${limite.toLocaleString("pt-BR")} ${NOMES[recurso]} e já há ` +
        `${uso[recurso].toLocaleString("pt-BR")}. Amplie o plano para cadastrar mais.`,
    );
}
