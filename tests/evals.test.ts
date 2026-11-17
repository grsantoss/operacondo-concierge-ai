/** Avaliação do agente (#27): critérios e o arquivo de perguntas. Sem banco nem Claude. */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { avaliar, type Caso } from "../src/server/evals/run";

const PASTA = `${import.meta.dir}/../src/server/evals`;
const casos = readFileSync(`${PASTA}/perguntas.jsonl`, "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as Caso);

describe("perguntas.jsonl", () => {
  test("ids únicos, campos válidos e documentos presentes", () => {
    expect(new Set(casos.map((c) => c.id)).size).toBe(casos.length);
    for (const c of casos) {
      expect(c.pergunta.length).toBeGreaterThan(0);
      expect(["aprovado", "pendente", "desconhecido"]).toContain(c.cadastro);
      if (c.espera.resultado)
        expect(["resposta", "sindico", "demanda"]).toContain(c.espera.resultado);
    }
    expect(readdirSync(`${PASTA}/documentos`).sort()).toEqual([
      "ata-2026.md",
      "comunicado.md",
      "convencao.md",
      "interno.md",
      "regimento.md",
    ]);
  });
});

describe("avaliar", () => {
  const caso: Caso = {
    id: "x",
    pergunta: "?",
    cadastro: "aprovado",
    espera: {
      resultado: "resposta",
      fonte: "Regimento Interno, Art. 1",
      contem: ["22H"],
      nao_contem: ["4821"],
    },
  };

  test("passa quando resultado, fonte e textos batem (sem diferenciar maiúsculas)", () => {
    const notas = avaliar(caso, {
      resultado: "resposta",
      texto: "O silêncio vai das 22h às 8h.\n\n📄 Regimento Interno, Art. 1",
      motivo: null,
    });
    expect(notas.map((n) => n.ok)).toEqual([true, true, true, true]);
  });

  test("falha em cada critério separadamente", () => {
    const notas = avaliar(caso, {
      resultado: "sindico",
      texto: "A senha é 4821.",
      motivo: "Sem base documental",
    });
    expect(notas.map((n) => [n.nome, n.ok])).toEqual([
      ["resultado", false],
      ["fonte", false],
      ['contém "22H"', false],
      ['não contém "4821"', false],
    ]);
    expect(notas[0]!.detalhe).toBe("sindico (Sem base documental)");
    expect(notas[1]!.detalhe).toBe("sem fonte");
  });

  test("fonte vem só da linha 📄, não do corpo", () => {
    const [n] = avaliar(
      { ...caso, espera: { fonte: "Convenção, Art. 2" } },
      { resultado: "resposta", texto: "Pela Convenção, Art. 2, pode.", motivo: null },
    );
    expect(n!.ok).toBe(false);
  });
});
