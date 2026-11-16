import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { type ConfigAgente, obterConfigAgente, salvarConfigAgente } from "@/lib/agente.functions";

export const configAgenteQuery = (condominioId: string) =>
  queryOptions({
    queryKey: ["agente-config", condominioId],
    queryFn: () => obterConfigAgente({ data: { condominioId } }),
  });

/** Grava a configuração do condomínio e atualiza o cache dele. */
export function useSalvarConfigAgente() {
  const qc = useQueryClient();
  return async (condominioId: string, config: ConfigAgente) => {
    await salvarConfigAgente({ data: { condominioId, config } });
    qc.setQueryData(configAgenteQuery(condominioId).queryKey, config);
  };
}
