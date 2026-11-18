import { queryOptions, useQuery } from "@tanstack/react-query";
import { meuPlano } from "@/lib/cobranca.functions";

export const meuPlanoQuery = queryOptions({
  queryKey: ["cobranca", "meu-plano"],
  queryFn: () => meuPlano(),
});

export const useMeuPlano = () => useQuery(meuPlanoQuery);
