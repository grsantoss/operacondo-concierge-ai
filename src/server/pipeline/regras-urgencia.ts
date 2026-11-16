/**
 * Regras fixas de urgência: alertam o síndico sem depender da IA nem dos limites do plano.
 * Texto comparado sem acento e em minúsculas. Vale a primeira regra que casar (ordem = gravidade).
 * ponytail: palavras-chave preferem alarme falso a alerta perdido ("fumaça de cigarro" alerta);
 * refinar com os casos reais.
 */
export interface RegraUrgencia {
  id: "gas" | "incendio" | "elevador" | "vazamento";
  rotulo: string;
  prioridade: "critica" | "alta";
  re: RegExp;
}

export const REGRAS: RegraUrgencia[] = [
  {
    id: "gas",
    rotulo: "Vazamento de gás",
    prioridade: "critica",
    re: /\b(cheiro (forte )?de gas|vazamento de gas|vazando gas|gas vazando|escapando gas|gas escapando)\b/,
  },
  {
    id: "incendio",
    rotulo: "Incêndio ou fumaça",
    prioridade: "critica",
    re: /\b(incendio|fogo|fumaca|pegando fogo|em chamas|chamas)\b/,
  },
  {
    id: "elevador",
    rotulo: "Pessoa presa no elevador",
    prioridade: "critica",
    re: /\b(pres[oa]s?|trancad[oa]s?)\b.{0,40}\belevador\b|\belevador\b.{0,40}\b(pres[oa]s?|trancad[oa]s?)\b/,
  },
  {
    id: "vazamento",
    rotulo: "Vazamento de água",
    prioridade: "alta",
    re: /\b(vazamento|vazando|alagad[oa]|alagamento|inundacao|inundad[oa]|cano estourado|estourou o cano)\b/,
  },
];

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function detectarUrgencia(texto: string | null | undefined): RegraUrgencia | null {
  if (!texto) return null;
  const t = normalizar(texto);
  return REGRAS.find((r) => r.re.test(t)) ?? null;
}
