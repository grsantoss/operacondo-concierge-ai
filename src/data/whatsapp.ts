import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  desconectarCanal,
  obterCanal,
  salvarCanal,
  verificarCanal,
  type CanalWhatsApp,
} from "@/lib/whatsapp.functions";

export const canalQuery = queryOptions({
  queryKey: ["whatsapp-canal"],
  queryFn: () => obterCanal(),
});

export function useCanal(): { canal: CanalWhatsApp | null; carregando: boolean } {
  const q = useQuery(canalQuery);
  return { canal: q.data ?? null, carregando: q.isPending };
}

export function useCanalAcoes() {
  const qc = useQueryClient();
  const recarregar = () => qc.invalidateQueries({ queryKey: canalQuery.queryKey });
  return {
    async salvar(d: { telefone: string; instanceId: string; token: string; clientToken: string }) {
      await salvarCanal({ data: d });
      await recarregar();
    },
    async verificar() {
      try {
        return await verificarCanal();
      } finally {
        await recarregar();
      }
    },
    async desconectar() {
      await desconectarCanal();
      await recarregar();
    },
  };
}
