import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  enviarDocumentos,
  excluirDocumento,
  lerDocumentoDeNovo,
  listarDocumentos,
} from "@/lib/base.functions";

/** Coleções da base. Os ids são os do banco (enum `colecao`). Ordem = prevalência das regras. */
export const COLECOES = [
  {
    id: "convencao",
    label: "Convenção",
    icon: "gavel",
    color: "from-blue-500 to-blue-700",
    desc: "Documento fundador do condomínio",
  },
  {
    id: "estatuto",
    label: "Estatuto",
    icon: "account_balance",
    color: "from-indigo-500 to-indigo-700",
    desc: "Estatuto da associação ou do condomínio",
  },
  {
    id: "regimento",
    label: "Regimento Interno",
    icon: "rule",
    color: "from-violet-500 to-violet-700",
    desc: "Regras de convivência",
  },
  {
    id: "ata",
    label: "Atas de Assembleia",
    icon: "history_edu",
    color: "from-emerald-500 to-emerald-700",
    desc: "Decisões e deliberações",
  },
  {
    id: "procedimento",
    label: "Procedimentos",
    icon: "checklist",
    color: "from-amber-500 to-amber-700",
    desc: "Fluxos operacionais padrão",
  },
  {
    id: "comunicado",
    label: "Comunicados",
    icon: "campaign",
    color: "from-rose-500 to-rose-700",
    desc: "Avisos enviados a moradores",
  },
  {
    id: "manual",
    label: "Manuais técnicos",
    icon: "engineering",
    color: "from-slate-500 to-slate-700",
    desc: "Equipamentos e manutenções",
  },
] as const;
export type ColecaoId = (typeof COLECOES)[number]["id"];

/** Quem pode ver o documento (e o que a IA pode citar para quem). */
export const VISIBILIDADES = [
  { id: "interno", label: "Interno (só o síndico)", icon: "shield_person" },
  { id: "conselho", label: "Conselho", icon: "groups" },
  { id: "moradores", label: "Moradores cadastrados", icon: "apartment" },
  { id: "publico", label: "Público (qualquer contato)", icon: "public" },
] as const;
export type VisibilidadeId = (typeof VISIBILIDADES)[number]["id"];

export type StatusDocumento = "enviado" | "processando" | "revisao" | "treinado" | "erro";

export const STATUS_DOC: Record<StatusDocumento, { label: string; cls: string; dot: string }> = {
  enviado: {
    label: "Aguardando leitura",
    cls: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  processando: {
    label: "Lendo",
    cls: "bg-amber-50 text-amber-700",
    dot: "bg-warning animate-pulse",
  },
  revisao: { label: "Revisar", cls: "bg-amber-50 text-amber-700", dot: "bg-warning" },
  treinado: {
    label: "Pronto para a IA",
    cls: "bg-success/10 text-success-strong",
    dot: "bg-success",
  },
  erro: {
    label: "Erro na leitura",
    cls: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

export interface Documento {
  id: string;
  titulo: string;
  colecao: ColecaoId;
  visibilidade: VisibilidadeId;
  condominioId: string;
  condominio: string;
  tamanho: string;
  enviadoEm: string;
  vigenteDesde?: string;
  status: StatusDocumento;
  /** Erro da leitura ou páginas a revisar. */
  aviso: string | null;
  /** Trechos citáveis gravados pela leitura. */
  trechos: number;
  url: string;
}

export const documentosQuery = queryOptions({
  queryKey: ["documentos"],
  queryFn: () => listarDocumentos(),
});

export function useDocumentos(): Documento[] {
  return (
    useQuery({
      ...documentosQuery,
      // Enquanto houver documento na fila ou sendo lido, confere a cada 5 s.
      refetchInterval: (q) =>
        q.state.data?.some((d) => d.status === "enviado" || d.status === "processando")
          ? 5000
          : false,
    }).data ?? []
  );
}

export function useDocumentosAcoes() {
  const qc = useQueryClient();
  const recarregar = () => qc.invalidateQueries({ queryKey: documentosQuery.queryKey });
  return {
    async enviar(
      meta: {
        condominioId: string;
        titulo: string;
        colecao: ColecaoId;
        visibilidade: VisibilidadeId;
        vigenteDesde?: string;
      },
      arquivos: File[],
    ) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(meta)) if (v) fd.set(k, v);
      for (const f of arquivos) fd.append("arquivos", f);
      await enviarDocumentos({ data: fd });
      await recarregar();
    },
    async lerDeNovo(id: string) {
      await lerDocumentoDeNovo({ data: { id } });
      await recarregar();
    },
    async excluir(id: string) {
      await excluirDocumento({ data: { id } });
      await recarregar();
    },
  };
}
