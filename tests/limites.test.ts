import { expect, test } from "bun:test";
import { calcularLimites, iaNoLimite } from "@/server/billing/limites";

const plano = (o: Record<string, unknown>) =>
  ({
    condominiosInclusos: 1,
    limiteCondominios: 50,
    limiteMoradores: 300,
    limiteDocumentos: 20,
    limiteRespostasIaMes: 1000,
    tetoCustoIaMes: "90.00",
    usaConselheiro: false,
    ...o,
  }) as never;

test("limites multiplicam pelos condomínios e respeitam o máximo do plano", () => {
  const l = calcularLimites(plano({}), 3, null);
  expect(l).toMatchObject({
    condominios: 3,
    moradores: 900,
    respostasIaMes: 3000,
    tetoCustoIaMes: 270,
  });
  expect(calcularLimites(plano({ limiteCondominios: 4 }), 9, null).condominios).toBe(4);
  // Profissional: 5 inclusos mesmo com quantidade menor.
  expect(calcularLimites(plano({ condominiosInclusos: 5 }), 3, null).condominios).toBe(5);
});

test("no trial valem os limites do plano trial, sem multiplicar", () => {
  const trial = plano({ limiteCondominios: 1, limiteMoradores: 50, limiteRespostasIaMes: 150 });
  expect(calcularLimites(plano({}), 5, trial)).toMatchObject({
    condominios: 1,
    moradores: 50,
    respostasIaMes: 150,
  });
});

test("IA para no limite de respostas ou no teto de custo (US$ × câmbio)", () => {
  const l = calcularLimites(plano({}), 1, null); // 1.000 respostas, teto R$ 90
  const uso = { condominios: 1, moradores: 0, documentos: 0, respostasIa: 999, custoIaUsd: 1 };
  expect(iaNoLimite(uso, l)).toBeNull();
  expect(iaNoLimite({ ...uso, respostasIa: 1000 }, l)).toContain("respostas");
  expect(iaNoLimite({ ...uso, custoIaUsd: 20 }, l)).toContain("custo");
});
