import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  anexarArquivos,
  assumirDemanda,
  criarDemanda,
  listarDemandas,
  obterDemanda,
  resolverDemanda,
} from "@/lib/demandas.functions";

export type Priority = "Crítica" | "Alta" | "Normal";
export type Category = "Manutenção" | "Segurança" | "Limpeza" | "Administrativo";
export type ColumnId = "novas" | "triagem" | "execucao" | "resolvidas";

export interface TimelineEvent {
  at: string;
  actor: string;
  action: string;
  detail?: string;
  channel?: "WhatsApp" | "Portal" | "Portaria" | "IA" | "Sistema";
}

export interface Message {
  at: string;
  from: "morador" | "sindico" | "ia" | "fornecedor";
  author: string;
  text: string;
}

export interface Attachment {
  name: string;
  size: string;
  kind: "image" | "pdf" | "video";
  url?: string;
}

export interface Demanda {
  id: string;
  title: string;
  description: string;
  morador: string;
  moradorId?: string;
  unit: string;
  priority: Priority;
  category: Category;
  age: string;
  createdAt: string;
  sla?: string;
  assigned?: string;
  assumedBy?: string;
  column: ColumnId;
  location: string;
  contact: { phone: string; email: string };
  attachments: Attachment[];
  timeline: TimelineEvent[];
  messages: Message[];
  cost?: { estimated: number; approved?: number };
}

export const COLUMNS: { id: ColumnId; title: string; accent: string }[] = [
  { id: "novas", title: "Novas", accent: "bg-[var(--color-brand)]" },
  { id: "triagem", title: "Triagem", accent: "bg-[var(--color-warning-strong)]" },
  { id: "execucao", title: "Em execução", accent: "bg-[var(--color-temp-warm)]" },
  { id: "resolvidas", title: "Resolvidas", accent: "bg-[var(--color-success-strong)]" },
];

export const PRIO_CLASS: Record<Priority, string> = {
  Crítica: "bg-destructive/10 text-destructive border-destructive/30",
  Alta: "bg-amber-50 text-amber-700 border-amber-300/60",
  Normal: "bg-muted text-muted-foreground border-border",
};

export const CAT_ICON: Record<Category, string> = {
  Manutenção: "build",
  Segurança: "shield",
  Limpeza: "cleaning_services",
  Administrativo: "description",
};

/* -------- Dados do banco (React Query) -------- */

export const demandasQuery = queryOptions({
  queryKey: ["demandas"],
  queryFn: () => listarDemandas(),
});

export const demandaQuery = (codigo: string) =>
  queryOptions({
    queryKey: ["demandas", codigo],
    queryFn: () => obterDemanda({ data: { codigo } }),
  });

export function useDemandas(): Demanda[] {
  return useQuery(demandasQuery).data ?? [];
}

/** Mesma categoria ou mesma unidade, até 3. */
export function relacionadas(todas: Demanda[], atual: Demanda): Demanda[] {
  return todas
    .filter((d) => d.id !== atual.id && (d.category === atual.category || d.unit === atual.unit))
    .slice(0, 3);
}

export function vizinhas(todas: Demanda[], id: string): { prev?: Demanda; next?: Demanda } {
  const i = todas.findIndex((d) => d.id === id);
  return i === -1 ? {} : { prev: todas[i - 1], next: todas[i + 1] };
}

/** Gravações: vão ao banco e recarregam lista e detalhe. Erros chegam com mensagem pronta. */
export function useDemandasAcoes() {
  const qc = useQueryClient();
  const recarregar = () => qc.invalidateQueries({ queryKey: ["demandas"] });
  return {
    async criar(input: Parameters<typeof criarDemanda>[0]["data"]) {
      const r = await criarDemanda({ data: input });
      await recarregar();
      return r.codigo;
    },
    async resolver(codigo: string) {
      await resolverDemanda({ data: { codigo } });
      await recarregar();
    },
    async assumir(codigo: string) {
      await assumirDemanda({ data: { codigo } });
      await recarregar();
    },
    async anexar(codigo: string, arquivos: File[]) {
      const fd = new FormData();
      fd.set("codigo", codigo);
      for (const f of arquivos) fd.append("arquivos", f);
      await anexarArquivos({ data: fd });
      await recarregar();
    },
  };
}
