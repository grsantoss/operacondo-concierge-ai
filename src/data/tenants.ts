import { useEffect, useState } from "react";
import type { PlanoId } from "./planos";

export type TenantStatus = "ativo" | "trial" | "suspenso";
export type ApiStatus = "ativa" | "revogada";

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
  plano: PlanoId;
  status: TenantStatus;
  createdAt: string;
  apiKey: string;
  apiStatus: ApiStatus;
  mrr: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  uso: { demandas: number; moradores: number; msgs: number };
}

function genKey() {
  const rand = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `ock_live_${rand}`;
}

const TENANTS: Tenant[] = [
  {
    id: "t1",
    razaoSocial: "Aurora Administração Ltda",
    nomeFantasia: "Edifício Aurora",
    cnpj: "12.345.678/0001-90",
    email: "roberto@aurora.com.br",
    telefone: "(11) 98888-1111",
    cidade: "São Paulo",
    uf: "SP",
    responsavel: "Roberto Silva",
    plano: "pro",
    status: "ativo",
    createdAt: "2025-02-14",
    apiKey: genKey(),
    apiStatus: "ativa",
    mrr: 699,
    stripeCustomerId: "cus_AuroraMock",
    stripeSubscriptionId: "sub_AuroraMock",
    uso: { demandas: 128, moradores: 412, msgs: 5820 },
  },
  {
    id: "t2",
    razaoSocial: "Vista Verde Condomínios S/A",
    nomeFantasia: "Residencial Vista Verde",
    cnpj: "22.111.333/0001-55",
    email: "sindico@vistaverde.com.br",
    telefone: "(21) 97777-2222",
    cidade: "Rio de Janeiro",
    uf: "RJ",
    responsavel: "Fernanda Lopes",
    plano: "enterprise",
    status: "ativo",
    createdAt: "2024-11-03",
    apiKey: genKey(),
    apiStatus: "ativa",
    mrr: 1899,
    stripeCustomerId: "cus_VistaMock",
    stripeSubscriptionId: "sub_VistaMock",
    uso: { demandas: 512, moradores: 2140, msgs: 41200 },
  },
  {
    id: "t3",
    razaoSocial: "Portal Sul Imóveis ME",
    nomeFantasia: "Cond. Portal Sul",
    cnpj: "33.999.121/0001-70",
    email: "contato@portalsul.com.br",
    telefone: "(51) 96666-3333",
    cidade: "Porto Alegre",
    uf: "RS",
    responsavel: "Carlos Menezes",
    plano: "starter",
    status: "trial",
    createdAt: "2026-06-28",
    apiKey: genKey(),
    apiStatus: "ativa",
    mrr: 0,
    stripeCustomerId: "cus_PortalMock",
    stripeSubscriptionId: "sub_PortalMock",
    uso: { demandas: 12, moradores: 88, msgs: 340 },
  },
  {
    id: "t4",
    razaoSocial: "Solar das Palmeiras Ltda",
    nomeFantasia: "Solar das Palmeiras",
    cnpj: "44.202.505/0001-12",
    email: "adm@solarpalmeiras.com.br",
    telefone: "(31) 95555-4444",
    cidade: "Belo Horizonte",
    uf: "MG",
    responsavel: "Marta Nogueira",
    plano: "pro",
    status: "suspenso",
    createdAt: "2025-05-19",
    apiKey: genKey(),
    apiStatus: "revogada",
    mrr: 0,
    stripeCustomerId: "cus_SolarMock",
    stripeSubscriptionId: "sub_SolarMock",
    uso: { demandas: 0, moradores: 320, msgs: 0 },
  },
  {
    id: "t5",
    razaoSocial: "Colina Azul Empreendimentos",
    nomeFantasia: "Ed. Colina Azul",
    cnpj: "55.808.404/0001-24",
    email: "sindica@colinaazul.com.br",
    telefone: "(41) 94444-5555",
    cidade: "Curitiba",
    uf: "PR",
    responsavel: "Renata Prado",
    plano: "pro",
    status: "ativo",
    createdAt: "2025-09-11",
    apiKey: genKey(),
    apiStatus: "ativa",
    mrr: 699,
    stripeCustomerId: "cus_ColinaMock",
    stripeSubscriptionId: "sub_ColinaMock",
    uso: { demandas: 74, moradores: 260, msgs: 3120 },
  },
];

type Listener = () => void;
const listeners = new Set<Listener>();
function emit() {
  listeners.forEach((l) => l());
}

export function useTenants() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return TENANTS;
}

export function getTenant(id: string): Tenant | undefined {
  return TENANTS.find((t) => t.id === id);
}

export function listTenants(): Tenant[] {
  return TENANTS;
}

export function updateTenant(id: string, patch: Partial<Tenant>) {
  const t = TENANTS.find((x) => x.id === id);
  if (!t) return;
  Object.assign(t, patch);
  emit();
}

export function createTenant(data: Omit<Tenant, "id" | "createdAt" | "apiKey" | "apiStatus" | "stripeCustomerId" | "stripeSubscriptionId" | "uso" | "mrr"> & { mrr?: number }): Tenant {
  const id = `t${TENANTS.length + 1}-${Math.random().toString(36).slice(2, 6)}`;
  const t: Tenant = {
    ...data,
    id,
    createdAt: new Date().toISOString().slice(0, 10),
    apiKey: genKey(),
    apiStatus: "ativa",
    mrr: data.mrr ?? 0,
    stripeCustomerId: `cus_${id}`,
    stripeSubscriptionId: `sub_${id}`,
    uso: { demandas: 0, moradores: 0, msgs: 0 },
  };
  TENANTS.push(t);
  emit();
  return t;
}

export function deleteTenant(id: string) {
  const i = TENANTS.findIndex((t) => t.id === id);
  if (i >= 0) {
    TENANTS.splice(i, 1);
    emit();
  }
}

export function rotateApiKey(id: string): string | null {
  const t = TENANTS.find((x) => x.id === id);
  if (!t) return null;
  t.apiKey = genKey();
  t.apiStatus = "ativa";
  emit();
  return t.apiKey;
}
