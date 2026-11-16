import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  desconectarCanal,
  obterCanal,
  obterMeuAlerta,
  salvarMeuAlerta,
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

export const meuAlertaQuery = queryOptions({
  queryKey: ["meu-alerta"],
  queryFn: () => obterMeuAlerta(),
});

export function useMeuAlerta() {
  const qc = useQueryClient();
  const q = useQuery(meuAlertaQuery);
  return {
    telefone: q.data?.telefone ?? "",
    carregando: q.isPending,
    async salvar(telefone: string) {
      await salvarMeuAlerta({ data: { telefone } });
      await qc.invalidateQueries({ queryKey: meuAlertaQuery.queryKey });
    },
  };
}
