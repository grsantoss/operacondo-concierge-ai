import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { atualizarLimitesPlano, listarPlanos } from "@/lib/admin.functions";

/** Plano da tabela `planos`. Preço só para exibir; o cobrado é o do Stripe. */
export interface Plano {
  id: string;
  nome: string;
  precoMensal: number;
  condominios: number;
  moradores: number;
  documentos: number;
  respostasIaMes: number;
  usaConselheiro: boolean;
  /** false = plano interno (trial). */
  vendavel: boolean;
}

export const planosQuery = queryOptions({
  queryKey: ["admin", "planos"],
  queryFn: () => listarPlanos(),
});

export function usePlanos(): Plano[] {
  return useQuery(planosQuery).data ?? [];
}

export type LimitesPlano = Pick<
  Plano,
  "condominios" | "moradores" | "documentos" | "respostasIaMes"
>;

export function useSalvarLimitesPlano() {
  const qc = useQueryClient();
  return async (id: string, l: LimitesPlano) => {
    await atualizarLimitesPlano({ data: { id, ...l } });
    await qc.invalidateQueries({ queryKey: ["admin"] });
  };
}
