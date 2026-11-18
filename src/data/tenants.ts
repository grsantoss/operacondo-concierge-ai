import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { atualizarCliente, criarCliente, listarClientes, trocarPlano } from "@/lib/admin.functions";

/** Derivado da assinatura e da fatura (webhook e job diário da Fase 6); não se edita à mão. */
export type TenantStatus =
  | "trial"
  | "ativo"
  | "inadimplente"
  | "suspenso"
  | "cancelado"
  | "excluido";

export interface Tenant {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  email: string;
  telefone: string;
  cidade: string;
  uf: string;
  responsavel: string;
  /** id do plano da assinatura mais recente ("" = sem assinatura). */
  plano: string;
  status: TenantStatus;
  assinaturaStatus: string | null;
  trialFim: string;
  createdAt: string;
  mrr: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  /** Do mês atual (view `uso_mensal`). */
  uso: { condominios: number; moradores: number; documentos: number; respostasIa: number };
  membros: { nome: string; email: string; papel: string }[];
}

export type DadosCliente = Pick<
  Tenant,
  "razaoSocial" | "nomeFantasia" | "cnpj" | "email" | "telefone" | "cidade" | "uf" | "responsavel"
>;

export const STATUS_CLIENTE: Record<TenantStatus, { label: string; tone: string }> = {
  ativo: {
    label: "Ativo",
    tone: "bg-[var(--color-success-soft)] text-[var(--color-success-strong)]",
  },
  trial: { label: "Trial", tone: "bg-[var(--color-info-soft)] text-[var(--color-brand)]" },
  inadimplente: {
    label: "Inadimplente",
    tone: "bg-[var(--color-warning-soft)] text-[var(--color-warning-strong)]",
  },
  suspenso: { label: "Suspenso", tone: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]" },
  cancelado: {
    label: "Cancelado",
    tone: "bg-[var(--color-surface-mid)] text-[var(--color-on-surface-variant)]",
  },
  excluido: {
    label: "Excluído",
    tone: "bg-[var(--color-surface-mid)] text-[var(--color-on-surface-variant)]",
  },
};

export const clientesQuery = queryOptions({
  queryKey: ["admin", "clientes"],
  queryFn: () => listarClientes(),
});

export function useTenants(): Tenant[] {
  return useQuery(clientesQuery).data ?? [];
}

export function useClientesAcoes() {
  const qc = useQueryClient();
  const recarregar = () => qc.invalidateQueries({ queryKey: clientesQuery.queryKey });
  return {
    async criar(dados: DadosCliente & { planoId: string }) {
      const r = await criarCliente({ data: dados });
      await recarregar();
      return r!;
    },
    async atualizar(id: string, dados: DadosCliente) {
      await atualizarCliente({ data: { id, ...dados } });
      await recarregar();
    },
    async trocarPlano(id: string, planoId: string) {
      await trocarPlano({ data: { id, planoId } });
      await recarregar();
    },
  };
}

export { erroAmigavel } from "@/lib/utils";
