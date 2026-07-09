import { useSyncExternalStore } from "react";

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

const ALL_CRIT = CRITERIOS_HOMOLOGACAO.map((c) => c.id);
const CORE_CRIT = ["cnpj", "contrato_social", "cnd", "fgts", "cndt"];

let _suppliers: Supplier[] = [
  {
    id: "f1",
    nome: "ElétricaPro Engenharia",
    categoria: "Elétrica & Iluminação",
    estado: "Homologado",
    rating: 4.9,
    ultimos: 18,
    cnpj: "12.345.678/0001-90",
    contato: "+55 11 99888-1010",
    email: "contato@eletricapro.com.br",
    docs: [
      { name: "Cartao_CNPJ.pdf", kind: "cnpj", uploadedAt: "10/03/2026" },
      { name: "Apolice_RC_2026.pdf", kind: "apolice", validUntil: "31/12/2026", uploadedAt: "05/01/2026" },
      { name: "ART_Servicos.pdf", kind: "art", uploadedAt: "20/02/2026" },
    ],
    homologacao: { criteriosOk: ALL_CRIT, validoAte: "10/03/2027" },
  },
  {
    id: "f2",
    nome: "AquaService Piscinas",
    categoria: "Piscina & Lazer",
    estado: "Homologado",
    rating: 4.7,
    ultimos: 9,
    cnpj: "22.987.654/0001-12",
    contato: "+55 11 98777-2020",
    email: "atendimento@aquaservice.com.br",
    docs: [
      { name: "Cartao_CNPJ.pdf", kind: "cnpj", uploadedAt: "12/01/2026" },
      { name: "CND_Federal.pdf", kind: "certidao", validUntil: "30/07/2026", uploadedAt: "12/01/2026" },
    ],
    homologacao: { criteriosOk: [...CORE_CRIT, "rc", "rating"], validoAte: "12/01/2027" },
  },
  {
    id: "f3",
    nome: "Guarda24 Segurança",
    categoria: "Segurança Patrimonial",
    estado: "Renovação",
    rating: 4.6,
    ultimos: 24,
    cnpj: "33.111.222/0001-33",
    contato: "+55 11 97666-3030",
    email: "comercial@guarda24.com.br",
    docs: [
      { name: "Cartao_CNPJ.pdf", kind: "cnpj", uploadedAt: "01/06/2025" },
      { name: "Apolice_RC_2025.pdf", kind: "apolice", validUntil: "30/09/2026", uploadedAt: "01/06/2025" },
    ],
    homologacao: { criteriosOk: [...CORE_CRIT, "rc", "rating"], validoAte: "30/09/2026" },
  },
  {
    id: "f4",
    nome: "LimpaTudo Predial",
    categoria: "Limpeza & Conservação",
    estado: "Em análise",
    rating: 4.3,
    ultimos: 3,
    cnpj: "44.222.333/0001-44",
    contato: "+55 11 96555-4040",
    email: "contato@limpatudo.com.br",
    docs: [{ name: "Cartao_CNPJ.pdf", kind: "cnpj", uploadedAt: "20/05/2026" }],
    homologacao: { criteriosOk: ["cnpj", "contrato_social"] },
  },
  {
    id: "f5",
    nome: "ClimaCerto HVAC",
    categoria: "Ar-condicionado",
    estado: "Homologado",
    rating: 4.8,
    ultimos: 12,
    cnpj: "55.333.444/0001-55",
    contato: "+55 11 95444-5050",
    email: "contato@climacerto.com.br",
    docs: [
      { name: "Cartao_CNPJ.pdf", kind: "cnpj", uploadedAt: "10/02/2026" },
      { name: "ART_HVAC.pdf", kind: "art", uploadedAt: "10/02/2026" },
    ],
    homologacao: { criteriosOk: ALL_CRIT, validoAte: "10/02/2027" },
  },
  {
    id: "f6",
    nome: "Jardim Vivo Paisagismo",
    categoria: "Jardinagem",
    estado: "Em análise",
    rating: 4.1,
    ultimos: 2,
    cnpj: "66.444.555/0001-66",
    contato: "+55 11 94333-6060",
    email: "contato@jardimvivo.com.br",
    docs: [{ name: "Cartao_CNPJ.pdf", kind: "cnpj", uploadedAt: "01/06/2026" }],
    homologacao: { criteriosOk: ["cnpj"] },
  },
  {
    id: "f7",
    nome: "Elevatec Modernização",
    categoria: "Elevadores",
    estado: "Homologado",
    rating: 4.9,
    ultimos: 7,
    cnpj: "77.555.666/0001-77",
    contato: "+55 11 93222-7070",
    email: "contato@elevatec.com.br",
    docs: [
      { name: "Cartao_CNPJ.pdf", kind: "cnpj", uploadedAt: "18/04/2026" },
      { name: "ART_Elevadores.pdf", kind: "art", uploadedAt: "18/04/2026" },
    ],
    homologacao: { criteriosOk: ALL_CRIT, validoAte: "18/04/2027" },
  },
  {
    id: "f8",
    nome: "DedetiSul Controle",
    categoria: "Dedetização",
    estado: "Inativo",
    rating: 3.8,
    ultimos: 0,
    cnpj: "88.666.777/0001-88",
    contato: "+55 11 92111-8080",
    email: "contato@dedetisul.com.br",
    docs: [],
    homologacao: { criteriosOk: [] },
  },
];

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function useSuppliers(): Supplier[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => _suppliers,
    () => _suppliers,
  );
}

export function getSupplier(id: string) {
  return _suppliers.find((s) => s.id === id);
}

export function updateSupplier(id: string, patch: Partial<Supplier>) {
  _suppliers = _suppliers.map((s) => (s.id === id ? { ...s, ...patch } : s));
  emit();
}

export function toggleCriterio(id: string, criterioId: string) {
  _suppliers = _suppliers.map((s) => {
    if (s.id !== id) return s;
    const has = s.homologacao.criteriosOk.includes(criterioId);
    return {
      ...s,
      homologacao: {
        ...s.homologacao,
        criteriosOk: has
          ? s.homologacao.criteriosOk.filter((c) => c !== criterioId)
          : [...s.homologacao.criteriosOk, criterioId],
      },
    };
  });
  emit();
}

export function homologarSupplier(id: string) {
  const stamp = new Date();
  const validoAte = new Date(stamp);
  validoAte.setMonth(validoAte.getMonth() + 12);
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR");
  _suppliers = _suppliers.map((s) =>
    s.id === id
      ? {
          ...s,
          estado: "Homologado" as Estado,
          homologacao: { ...s.homologacao, validoAte: fmt(validoAte) },
        }
      : s,
  );
  emit();
}

export function arquivarSupplier(id: string) {
  _suppliers = _suppliers.map((s) =>
    s.id === id ? { ...s, estado: "Inativo" as Estado } : s,
  );
  emit();
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
