/**
 * Texto que vai ao modelo (sistema, mensagens e ferramentas), por canal. Sem banco: o contexto é
 * montado à mão. Mudou o snapshot? Confira o diff antes de `bun test -u` (#102).
 */
import type { BetaMessage } from "@anthropic-ai/sdk/resources/beta";
import { expect, test } from "bun:test";
import { ConfigAgente } from "../src/lib/agente.functions";
import type { Contexto } from "../src/server/agent/contexto";
import { paraOSindico } from "../src/server/agent/guardrails";
import { mensagens, sistema } from "../src/server/agent/prompt";
import { ferramentas } from "../src/server/agent/tools";

function contexto(canal: "whatsapp" | "email", extra: Partial<Contexto> = {}): Contexto {
  const agora = new Date("2026-11-26T12:00:00Z");
  const msg = (texto: string, assunto: string | null = null) =>
    ({
      id: "m1",
      direcao: "entrada",
      autor: "morador",
      tipo: "texto",
      texto,
      assunto,
      transcricao: null,
      criadoEm: agora,
    }) as Contexto["historico"][number];
  return {
    conversa: {
      id: "c1",
      tenantId: "t1",
      canal,
      condominioId: "k1",
      moradorId: null,
      endereco: canal === "email" ? "ana@exemplo.com" : "+5511900000000",
    } as Contexto["conversa"],
    condominio: "Edifício Aurora",
    morador: { nome: "Ana", cadastro: "aprovado" },
    config: ConfigAgente.parse({}),
    instrucoes: null,
    documentos: [
      {
        id: "d1",
        titulo: "Regimento 2024",
        colecao: "regimento",
        vigenteDesde: "2024-03-01",
        revogaTitulo: null,
        trechos: [{ referencia: "Art. 12", texto: "Art. 12. A piscina abre às 8h." }],
      },
    ],
    historico: [msg("Que horas abre a piscina?", canal === "email" ? "Piscina" : null)],
    demandas: [{ codigo: "D-2401", titulo: "Lâmpada do hall" }],
    ...extra,
  };
}

const ferramentasDe = (ctx: Contexto) =>
  ferramentas(ctx, { escalar: null, trocouCondominio: false }).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));

for (const canal of ["whatsapp", "email"] as const) {
  test(`prompt do ${canal}`, () => {
    const ctx = contexto(canal);
    expect(sistema(ctx)).toMatchSnapshot();
    expect(mensagens(ctx)).toMatchSnapshot();
    expect(ferramentasDe(ctx)).toMatchSnapshot();
  });

  test(`prompt do ${canal} com orientações do síndico e tom formal`, () => {
    const ctx = contexto(canal, {
      instrucoes: "Mudanças só de segunda a sábado.",
      config: ConfigAgente.parse({ tom: "formal" }),
    });
    expect(sistema(ctx)).toMatchSnapshot();
  });
}

test("paraOSindico: sem base, recusa e corte vão ao síndico; resposta com base segue", () => {
  const r = (stop_reason: string) => ({ stop_reason }) as unknown as BetaMessage;
  expect(paraOSindico(r("end_turn"), "A piscina abre às 8h.")).toBeNull();
  expect(paraOSindico(r("end_turn"), "[SEM_BASE] Rascunho")).toEqual({
    motivo: "Sem base documental",
    rascunho: "Rascunho",
  });
  expect(paraOSindico(r("end_turn"), "")).toEqual({
    motivo: "Sem base documental",
    rascunho: null,
  });
  expect(paraOSindico(r("refusal"), "[SEM_BASE] x")).toEqual({
    motivo: "A IA recusou responder",
    rascunho: "x",
  });
  expect(paraOSindico(r("tool_use"), "Vou ver")).toEqual({
    motivo: "A IA não concluiu a resposta",
    rascunho: null,
  });
});
