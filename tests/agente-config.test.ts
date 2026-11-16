import { expect, test } from "bun:test";
import { ConfigAgente } from "../src/lib/agente.functions";

test("sem configuração gravada, valem os padrões", () => {
  const c = ConfigAgente.parse({});
  expect(c.tom).toBe("cordial");
  expect(c.limiteAprovacao).toBe(500);
  expect(c.opcoes.reclamacoes.escalar).toBe("reincidente");
  expect(c.opcoes.manutencao.exigirFoto).toBe(true);
});

test("configuração antiga, sem campos novos, continua válida", () => {
  const c = ConfigAgente.parse({
    tom: "direto",
    limiteAprovacao: null,
    opcoes: { reservas: false },
  });
  expect(c.opcoes.reservas).toBe(false);
  expect(c.opcoes.horarios).toBe(true);
  expect(c.limiteAprovacao).toBeNull();
});

test("valor fora do permitido é recusado", () => {
  expect(ConfigAgente.safeParse({ tom: "casual" }).success).toBe(false);
  expect(ConfigAgente.safeParse({ limiteAprovacao: -1 }).success).toBe(false);
});
