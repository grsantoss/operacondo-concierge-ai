import { describe, expect, test } from "bun:test";
import {
  mesmoPreco,
  paramsDoPreco,
  precosDoAdicional,
  precosDoPlano,
  valorDosDegraus,
  type PrecoStripe,
} from "../src/server/billing/catalogo";

const essencial = {
  id: "essencial",
  nome: "Essencial",
  precoMensal: 197,
  condominiosInclusos: 1,
  precoCondominioAdicional: 97,
};
const profissional = {
  id: "profissional",
  nome: "Profissional",
  precoMensal: 547,
  condominiosInclusos: 5,
  precoCondominioAdicional: 97,
};

describe("catálogo do Stripe", () => {
  test("lookup_key com prefixo do Concierge, mensal e anual", () => {
    expect(precosDoPlano(essencial).map((p) => p.lookupKey)).toEqual([
      "concierge_essencial_mensal",
      "concierge_essencial_anual",
    ]);
    expect(precosDoAdicional().map((p) => [p.lookupKey, p.unitAmount])).toEqual([
      ["concierge_whatsapp_gerenciado_mensal", 11900],
      ["concierge_whatsapp_gerenciado_anual", 119000],
    ]);
  });

  test("escada de preço por número de condomínios", () => {
    const [ess] = precosDoPlano(essencial);
    const [pro] = precosDoPlano(profissional);
    expect([1, 2, 4].map((n) => valorDosDegraus(ess.degraus!, n))).toEqual([19700, 29400, 48800]);
    expect([1, 5, 6].map((n) => valorDosDegraus(pro.degraus!, n))).toEqual([54700, 54700, 64400]);
  });

  test("anual = 10 × mensal", () => {
    const anual = precosDoPlano(profissional)[1];
    expect(valorDosDegraus(anual.degraus!, 6)).toBe(644000);
  });

  test("parâmetros do preço escalonado", () => {
    const p = paramsDoPreco(precosDoPlano(profissional)[0]);
    expect(p).toMatchObject({
      currency: "brl",
      billing_scheme: "tiered",
      tiers_mode: "graduated",
      transfer_lookup_key: true,
      recurring: { interval: "month", interval_count: 1 },
      tiers: [
        { up_to: 5, flat_amount: 54700 },
        { up_to: "inf", unit_amount: 9700 },
      ],
    });
  });

  test("compara com o preço que o Stripe devolve", () => {
    const d = precosDoPlano(essencial)[0];
    const doStripe: PrecoStripe = {
      currency: "brl",
      billing_scheme: "tiered",
      tiers_mode: "graduated",
      unit_amount: null,
      recurring: { interval: "month", interval_count: 1 },
      tiers: [
        { up_to: 1, flat_amount: 19700, unit_amount: null },
        { up_to: null, flat_amount: null, unit_amount: 9700 },
      ],
    };
    expect(mesmoPreco(doStripe, d)).toBe(true);
    expect(
      mesmoPreco(
        {
          ...doStripe,
          tiers: [doStripe.tiers![0], { up_to: null, flat_amount: null, unit_amount: 8700 }],
        },
        d,
      ),
    ).toBe(false);
    expect(mesmoPreco({ ...doStripe, recurring: { interval: "year", interval_count: 1 } }, d)).toBe(
      false,
    );
  });
});
