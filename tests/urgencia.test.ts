import { expect, test } from "bun:test";
import { maiorPrioridade } from "../src/lib/urgencia";

test("conversa assume a maior urgência entre triagem e demandas abertas", () => {
  expect(maiorPrioridade("Normal")).toBe("Normal");
  expect(maiorPrioridade("Normal", "Alta", "Normal")).toBe("Alta");
  expect(maiorPrioridade("Alta", "Crítica")).toBe("Crítica");
  expect(maiorPrioridade("Crítica", "Normal")).toBe("Crítica");
});
