export type PlanoId = "starter" | "pro" | "enterprise";

export interface Plano {
  id: PlanoId;
  nome: string;
  precoMensal: number;
  moradores: number;
  msgsMes: number;
  condominios: number;
  destaque?: boolean;
}

export const PLANOS: Plano[] = [
  { id: "starter", nome: "Starter", precoMensal: 299, moradores: 200, msgsMes: 2000, condominios: 1 },
  { id: "pro", nome: "Pro", precoMensal: 699, moradores: 800, msgsMes: 10000, condominios: 3, destaque: true },
  { id: "enterprise", nome: "Enterprise", precoMensal: 1899, moradores: 5000, msgsMes: 60000, condominios: 20 },
];

export function getPlano(id: PlanoId): Plano {
  return PLANOS.find((p) => p.id === id) ?? PLANOS[0];
}
