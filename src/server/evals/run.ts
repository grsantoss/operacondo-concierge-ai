/**
 * Avaliação do agente (#27): `bun run evals`.
 *
 * Cria um cliente temporário com o condomínio fictício "Edifício Jacarandá" (documentos em
 * `documentos/`), manda cada pergunta de `perguntas.jsonl` pelo caminho real (entrada →
 * roteamento → agente, com o Claude de verdade e a Z-API falsa) e confere o resultado: resposta,
 * síndico ou demanda; a fonte citada; trechos que a resposta deve ou não conter. Com o Langfuse
 * configurado, as perguntas viram o dataset `concierge-perguntas` e cada execução vira um
 * experimento com as notas por critério. No fim, apaga o cliente temporário.
 *
 * `bun run evals piscina mudanca` roda só os casos cujo id contém um desses textos.
 */
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { and, desc, eq, sum } from "drizzle-orm";
import { MODELO_AGENTE, responder } from "@/server/agent/run";
import { cifrar } from "@/server/cripto";
import { dbAdmin, schema as s } from "@/server/db";
import { cortarTrechos } from "@/server/ingest/trechos";
import { iaConfigurada } from "@/server/llm";
import {
  encerrarObservabilidade,
  iniciarObservabilidade,
  langfuseConfigurado,
} from "@/server/observability";
import { processarConversa } from "@/server/pipeline/processar";
import { rotear } from "@/server/pipeline/roteamento";

export interface Caso {
  id: string;
  pergunta: string;
  cadastro: "aprovado" | "pendente" | "desconhecido";
  espera: {
    resultado?: Resultado;
    /** Trecho da linha "📄 …" (ex.: "Regimento Interno, Art. 2"). */
    fonte?: string;
    contem?: string[];
    nao_contem?: string[];
  };
}
type Resultado = "resposta" | "sindico" | "demanda";
export interface Saida {
  resultado: Resultado;
  /** O que o morador recebeu (todas as mensagens de saída, em ordem). */
  texto: string;
  /** Motivo de ter ido ao síndico (`conversas.rascunho_motivo`). */
  motivo: string | null;
}
export interface Nota {
  nome: string;
  ok: boolean;
  detalhe?: string;
}

/** Um critério por item de `espera`; o caso passa se todos passarem. */
export function avaliar(caso: Caso, saida: Saida): Nota[] {
  const e = caso.espera;
  const texto = saida.texto.toLowerCase();
  const notas: Nota[] = [];
  if (e.resultado)
    notas.push({
      nome: "resultado",
      ok: saida.resultado === e.resultado,
      detalhe: saida.motivo ? `${saida.resultado} (${saida.motivo})` : saida.resultado,
    });
  if (e.fonte) {
    const linha = saida.texto.split("\n").find((l) => l.startsWith("📄")) ?? "";
    notas.push({ nome: "fonte", ok: linha.includes(e.fonte), detalhe: linha || "sem fonte" });
  }
  for (const c of e.contem ?? [])
    notas.push({ nome: `contém "${c}"`, ok: texto.includes(c.toLowerCase()) });
  for (const c of e.nao_contem ?? [])
    notas.push({ nome: `não contém "${c}"`, ok: !texto.includes(c.toLowerCase()) });
  return notas;
}

const PASTA = fileURLToPath(new URL(".", import.meta.url));
const DOCUMENTOS: [
  string,
  string,
  (typeof s.colecao.enumValues)[number],
  (typeof s.visibilidade.enumValues)[number],
][] = [
  ["convencao.md", "Convenção do Edifício Jacarandá", "convencao", "moradores"],
  ["regimento.md", "Regimento Interno do Edifício Jacarandá", "regimento", "moradores"],
  ["ata-2026.md", "AGO 10/03/2026", "ata", "moradores"],
  ["comunicado.md", "Coleta seletiva", "comunicado", "publico"],
  ["interno.md", "Procedimentos internos", "procedimento", "interno"],
];

async function main() {
  if (!iaConfigurada()) {
    console.error("Defina ANTHROPIC_API_KEY: a avaliação chama o Claude de verdade.");
    process.exit(1);
  }
  const filtros = process.argv.slice(2);
  const casos = (await readFile(`${PASTA}/perguntas.jsonl`, "utf8"))
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Caso)
    .filter((c) => !filtros.length || filtros.some((f) => c.id.includes(f)));

  // Z-API falsa: o agente "envia" e a mensagem fica gravada em `mensagens`.
  const zapi = createServer((_, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ messageId: `EVAL-${crypto.randomUUID()}` }));
  });
  await new Promise<void>((ok) => zapi.listen(0, ok));
  process.env.ZAPI_URL = `http://localhost:${(zapi.address() as AddressInfo).port}`;
  iniciarObservabilidade("evals");

  const admin = dbAdmin();
  const [t] = await admin
    .insert(s.tenants)
    .values({ razaoSocial: "Avaliação do agente", nomeFantasia: "Avaliação do agente" })
    .returning();
  const tenantId = t!.id;
  try {
    const [c] = await admin
      .insert(s.condominios)
      .values({ tenantId, nome: "Edifício Jacarandá", tipo: "vertical" })
      .returning();
    const condominioId = c!.id;
    const [canal] = await admin
      .insert(s.whatsappCanais)
      .values({
        tenantId,
        phoneE164: "+5511900000027",
        provider: "zapi",
        instanceId: "EVAL",
        credenciaisCifradas: cifrar(JSON.stringify({ token: "eval" })),
      })
      .returning();
    for (const [arquivo, titulo, colecao, visibilidade] of DOCUMENTOS) {
      const [d] = await admin
        .insert(s.documentos)
        .values({
          tenantId,
          condominioId,
          titulo,
          colecao,
          visibilidade,
          status: "treinado",
          storagePath: `evals/${arquivo}`,
        })
        .returning();
      const trechos = cortarTrechos(await readFile(`${PASTA}/documentos/${arquivo}`, "utf8"));
      await admin.insert(s.documentoTrechos).values(
        trechos.map((tr, ordem) => ({
          tenantId,
          documentoId: d!.id,
          condominioId,
          referencia: tr.referencia,
          ordem,
          texto: tr.texto,
        })),
      );
    }

    let n = 0;
    /** Uma conversa nova por caso, de um telefone novo. */
    async function rodar(caso: Caso): Promise<Saida> {
      const telefone = `+55119555${String(++n).padStart(5, "0")}`;
      if (caso.cadastro !== "desconhecido") {
        const [m] = await admin
          .insert(s.moradores)
          .values({ tenantId, condominioId, nome: "Morador Teste", cadastro: caso.cadastro })
          .returning();
        await admin
          .insert(s.moradorContatos)
          .values({ tenantId, moradorId: m!.id, condominioId, phoneE164: telefone });
      }
      await admin.insert(s.whatsappEntradas).values({
        tenantId,
        canalId: canal!.id,
        telefone,
        providerMsgId: `EVAL-${caso.id}-${n}`,
        payload: { type: "ReceivedCallback", text: { message: caso.pergunta } },
      });
      const job = { tenantId, canalId: canal!.id, telefone };
      let agente: Awaited<ReturnType<typeof rotear>>["agente"] = null;
      let conversaId: string | null = null;
      await processarConversa(job, async (e) => {
        const r = await rotear(job, e);
        agente = r.agente;
      });
      if (agente) {
        conversaId = (agente as { conversaId: string }).conversaId;
        await responder(agente, true);
      }
      if (!conversaId) {
        const [cv] = await admin
          .select({ id: s.conversas.id })
          .from(s.conversas)
          .where(and(eq(s.conversas.tenantId, tenantId), eq(s.conversas.phoneE164, telefone)))
          .orderBy(desc(s.conversas.criadoEm))
          .limit(1);
        conversaId = cv?.id ?? null;
      }
      if (!conversaId) return { resultado: "resposta", texto: "", motivo: "sem conversa" };
      const [cv] = await admin.select().from(s.conversas).where(eq(s.conversas.id, conversaId));
      const saidas = await admin
        .select({ texto: s.mensagens.texto })
        .from(s.mensagens)
        .where(and(eq(s.mensagens.conversaId, conversaId), eq(s.mensagens.direcao, "saida")))
        .orderBy(s.mensagens.criadoEm);
      const [demanda] = await admin
        .select({ id: s.demandas.id })
        .from(s.demandas)
        .where(eq(s.demandas.conversaId, conversaId))
        .limit(1);
      return {
        resultado: demanda
          ? "demanda"
          : cv?.estado === "aguardando_sindico"
            ? "sindico"
            : "resposta",
        texto: saidas.map((m) => m.texto ?? "").join("\n\n"),
        motivo: cv?.rascunhoMotivo ?? null,
      };
    }

    const resultados: { caso: Caso; saida: Saida; notas: Nota[] }[] = [];
    const executar = async (caso: Caso) => {
      const saida = await rodar(caso);
      const notas = avaliar(caso, saida);
      resultados.push({ caso, saida, notas });
      const ok = notas.every((x) => x.ok);
      console.log(`${ok ? "✓" : "✗"} ${caso.id}`);
      for (const x of notas.filter((x) => !x.ok))
        console.log(`    ✗ ${x.nome}${x.detalhe ? `: ${x.detalhe}` : ""}`);
      if (!ok) console.log(`    resposta: ${saida.texto.replace(/\n+/g, " ⏎ ").slice(0, 300)}`);
      return { saida, notas };
    };

    if (langfuseConfigurado()) {
      const { LangfuseClient } = await import("@langfuse/client");
      const langfuse = new LangfuseClient();
      const nome = "concierge-perguntas";
      await langfuse.api.datasets.create({
        name: nome,
        description: "Perguntas do Edifício Jacarandá (src/server/evals/perguntas.jsonl)",
      });
      // Mesmo id = atualiza o item (o arquivo é a fonte; o Langfuse só espelha).
      for (const caso of casos)
        await langfuse.api.datasetItems.create({
          datasetName: nome,
          id: `${nome}-${caso.id}`,
          input: { id: caso.id, pergunta: caso.pergunta, cadastro: caso.cadastro },
          expectedOutput: caso.espera,
        });
      const ids = new Set(casos.map((c) => c.id));
      // Itens do dataset (não só os dados): assim o experimento fica ligado ao dataset.
      const dataset = await langfuse.dataset.get(nome);
      const r = await langfuse.experiment.run({
        data: dataset.items.filter((i) => ids.has((i.input as Caso).id)),
        name: "agente",
        runName: `${MODELO_AGENTE} ${new Date().toISOString().slice(0, 16)}`,
        metadata: { modelo: MODELO_AGENTE },
        maxConcurrency: 1,
        task: async ({ input }) => {
          const caso = casos.find((c) => c.id === (input as Caso).id)!;
          return executar(caso);
        },
        evaluators: [
          async ({ output }) =>
            (output as { notas: Nota[] }).notas.map((x) => ({
              name: x.nome,
              value: x.ok ? 1 : 0,
              comment: x.detalhe,
            })),
          async ({ output }) => ({
            name: "passou",
            value: (output as { notas: Nota[] }).notas.every((x) => x.ok) ? 1 : 0,
          }),
        ],
      });
      if (r.datasetRunUrl) console.log(`\nLangfuse: ${r.datasetRunUrl}`);
    } else {
      for (const caso of casos) await executar(caso);
    }

    const passou = resultados.filter((r) => r.notas.every((x) => x.ok)).length;
    const [custo] = await admin
      .select({ usd: sum(s.llmExecucoes.custoUsd) })
      .from(s.llmExecucoes)
      .where(eq(s.llmExecucoes.tenantId, tenantId));
    console.log(
      `\n${passou}/${resultados.length} casos passaram · ${MODELO_AGENTE} · US$ ${Number(custo?.usd ?? 0).toFixed(4)}`,
    );
    process.exitCode = passou === resultados.length ? 0 : 1;
  } finally {
    await admin.delete(s.tenants).where(eq(s.tenants.id, tenantId));
    zapi.close();
    await encerrarObservabilidade();
  }
}

// Só como script (`bun run evals`); o teste importa `avaliar` sem rodar nada.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("evals/run.ts")) await main();
