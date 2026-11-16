import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  alternarCriterio,
  arquivarFornecedor,
  atualizarFornecedor,
  criarFornecedor,
  enviarDocumentoFornecedor,
  homologarFornecedor,
  listarFornecedores,
} from "@/lib/fornecedores.functions";

export type Estado = "Homologado" | "Em análise" | "Renovação" | "Inativo";

export interface CriterioHomologacao {
  id: string;
  label: string;
  descricao: string;
  obrigatorio: boolean;
}

export const CRITERIOS_HOMOLOGACAO: CriterioHomologacao[] = [
  {
    id: "cnpj",
    label: "CNPJ ativo",
    descricao: "Cartão CNPJ atualizado emitido pela Receita Federal.",
    obrigatorio: true,
  },
  {
    id: "contrato_social",
    label: "Contrato social atualizado",
    descricao: "Última alteração contratual registrada na junta comercial.",
    obrigatorio: true,
  },
  {
    id: "cnd",
    label: "Certidões negativas (Federal, Estadual, Municipal)",
    descricao: "Certidões de débitos tributários vigentes.",
    obrigatorio: true,
  },
  {
    id: "fgts",
    label: "Regularidade FGTS",
    descricao: "CRF válida junto à Caixa Econômica Federal.",
    obrigatorio: true,
  },
  {
    id: "cndt",
    label: "Certidão trabalhista (CNDT)",
    descricao: "Certidão negativa de débitos trabalhistas do TST.",
    obrigatorio: true,
  },
  {
    id: "rc",
    label: "Apólice de responsabilidade civil",
    descricao: "Cobertura vigente compatível com o escopo dos serviços.",
    obrigatorio: true,
  },
  {
    id: "art",
    label: "ART / Ordem de serviço técnica",
    descricao: "Obrigatório para elétrica, elevadores, HVAC e obras.",
    obrigatorio: false,
  },
  {
    id: "rating",
    label: "Avaliação técnica interna ≥ 4.0",
    descricao: "Nota mínima em vistoria de qualidade da administração.",
    obrigatorio: true,
  },
];

export interface Doc {
  name: string;
  kind: "cnpj" | "contrato" | "certidao" | "apolice" | "art" | "outro";
  validUntil?: string;
  uploadedAt: string;
  /** Link temporário para abrir o arquivo (só quando há arquivo no S3). */
  url?: string;
}

export interface Supplier {
  id: string;
  nome: string;
  categoria: string;
  estado: Estado;
  rating: number;
  ultimos: number;
  cnpj: string;
  contato: string;
  email: string;
  contatoNome?: string;
  observacoes?: string;
  docs: Doc[];
  homologacao: {
    criteriosOk: string[];
    validoAte?: string;
  };
}

export const CATEGORIAS = [
  "Elétrica & Iluminação",
  "Hidráulica",
  "Piscina & Lazer",
  "Segurança Patrimonial",
  "Limpeza & Conservação",
  "Ar-condicionado",
  "Jardinagem",
  "Elevadores",
  "Dedetização",
  "Obras & Reformas",
  "TI & Telecom",
  "Administrativo",
] as const;

/* -------- Dados do banco (React Query) -------- */

export const fornecedoresQuery = queryOptions({
  queryKey: ["fornecedores"],
  queryFn: () => listarFornecedores(),
});

export function useSuppliers(): Supplier[] {
  return useQuery(fornecedoresQuery).data ?? [];
}

/** Gravações: vão ao banco e recarregam a lista. Erros chegam com mensagem pronta. */
export function useFornecedoresAcoes() {
  const qc = useQueryClient();
  const recarregar = () => qc.invalidateQueries({ queryKey: fornecedoresQuery.queryKey });
  const feito = <T,>(p: Promise<T>) => p.then(recarregar);
  return {
    updateSupplier: (id: string, patch: Parameters<typeof atualizarFornecedor>[0]["data"]["dados"]) =>
      feito(atualizarFornecedor({ data: { id, dados: patch } })),
    toggleCriterio: (id: string, criterioId: string) =>
      feito(alternarCriterio({ data: { id, criterioId } })),
    criarFornecedor: (dados: Parameters<typeof criarFornecedor>[0]["data"]) =>
      criarFornecedor({ data: dados }).then(async (r) => {
        await recarregar();
        return r.id;
      }),
    homologarSupplier: (id: string) => feito(homologarFornecedor({ data: { id } })),
    arquivarSupplier: (id: string) => feito(arquivarFornecedor({ data: { id } })),
    enviarDocumento(id: string, arquivo: File, kind: Doc["kind"], validoAte?: string) {
      const fd = new FormData();
      fd.set("fornecedorId", id);
      fd.set("tipo", kind);
      if (validoAte) fd.set("validoAte", validoAte);
      fd.set("arquivo", arquivo);
      return feito(enviarDocumentoFornecedor({ data: fd }));
    },
  };
}

export function isObrigatoriosOk(s: Supplier) {
  const necessarios = CRITERIOS_HOMOLOGACAO.filter((c) => {
    if (!c.obrigatorio) return false;
    if (c.id === "art") {
      return ["Elétrica & Iluminação", "Elevadores", "Ar-condicionado", "Obras & Reformas"].includes(s.categoria);
    }
    return true;
  }).map((c) => c.id);
  return necessarios.every((id) => s.homologacao.criteriosOk.includes(id));
}

export function whatsappUrl(phone: string, msg: string) {
  let digits = phone.replace(/\D/g, "");
  if (!digits.startsWith("55")) digits = "55" + digits;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}
