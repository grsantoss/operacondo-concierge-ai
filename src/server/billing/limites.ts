/**
 * Limites que valem para o cliente agora. Durante o trial valem os do plano interno `trial`
 * (totais); fora dele, os do plano contratado multiplicados pelos condomínios da assinatura.
 */
import { desc, eq } from "drizzle-orm";
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
