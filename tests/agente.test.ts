/** Núcleo do agente: contexto, prompt com documentos em cache, citações e escalonamento. Banco local. */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { desc, eq } from "drizzle-orm";
import { carregarContexto } from "../src/server/agent/contexto";
import { mensagens, SEM_BASE } from "../src/server/agent/prompt";
import { AVISO_SINDICO, responder } from "../src/server/agent/run";
import { cifrar } from "../src/server/cripto";
import { dbAdmin, schema as s, withTenant } from "../src/server/db";
import { processarConversa } from "../src/server/pipeline/processar";
import { rotear } from "../src/server/pipeline/roteamento";

process.env.CREDENCIAIS_CHAVE ??= Buffer.alloc(32, 7).toString("base64");
const admin = dbAdmin();
let srv: ReturnType<typeof Bun.serve>;
let tenantId: string, condo: string, canalId: string, moradorId: string;

type Pedido = {
  system: string;
  messages: { role: string; content: string | { type: string; [k: string]: unknown }[] }[];
};
const pedidos: Pedido[] = [];
const enviados: { phone: string; message: string }[] = [];
let resposta: { texto: string; citar?: [number, number] } = { texto: "" };
let falhar = false;
let durante: (() => Promise<void>) | null = null;

beforeAll(async () => {
  srv = Bun.serve({
    port: 0,
    async fetch(req) {
      const u = new URL(req.url);
      if (u.pathname.endsWith("/send-text")) {
        enviados.push((await req.json()) as { phone: string; message: string });
        return Response.json({ messageId: `OUT-${Date.now()}-${Math.random()}` });
      }
      if (u.pathname === "/v1/messages") {
        if (falhar)
          return Response.json(
            { type: "error", error: { type: "api_error", message: "fora" } },
            { status: 500 },
          );
        pedidos.push((await req.json()) as Pedido);
        await durante?.();
        const [doc, bloco] = resposta.citar ?? [];
        return Response.json({
          id: "msg_teste",
          type: "message",
          role: "assistant",
          model: "claude-haiku-5-5",
          content: [
            {
              type: "text",
              text: resposta.texto,
              citations:
                doc == null
                  ? null
                  : [
                      {
                        type: "content_block_location",
                        cited_text: "…",
                        document_index: doc,
                        document_title: null,
                        start_block_index: bloco,
                        end_block_index: bloco! + 1,
                        file_id: null,
                      },
                    ],
            },
          ],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: {
            input_tokens: 300,
            output_tokens: 50,
            cache_read_input_tokens: 4000,
            cache_creation_input_tokens: 0,
          },
        });
      }
      return new Response("?", { status: 404 });
    },
  });
  const base = `http://localhost:${srv.port}`;
  Object.assign(process.env, {
    ZAPI_URL: base,
    ANTHROPIC_BASE_URL: base,
    ANTHROPIC_API_KEY: "chave-teste",
    // Sem novas tentativas do SDK: o teste de falha fica rápido.
    ANTHROPIC_MAX_RETRIES: "0",
  });

  const [t] = await admin
    .insert(s.tenants)
    .values({ razaoSocial: "Teste Agente", nomeFantasia: "Teste Agente" })
    .returning();
  tenantId = t!.id;
  const [c] = await admin
    .insert(s.condominios)
    .values({ tenantId, nome: "Edifício Sol", tipo: "vertical" })
    .returning();
  condo = c!.id;
  const [m] = await admin
    .insert(s.moradores)
    .values({ tenantId, condominioId: condo, nome: "Bia", cadastro: "aprovado" })
    .returning();
  moradorId = m!.id;
  await admin
    .insert(s.moradorContatos)
    .values({ tenantId, moradorId, condominioId: condo, phoneE164: "+5511944440000" });
  const [ca] = await admin
    .insert(s.whatsappCanais)
    .values({
      tenantId,
      phoneE164: "+5511900007777",
      provider: "zapi",
      instanceId: "INST-AG",
      credenciaisCifradas: cifrar(JSON.stringify({ token: "tok" })),
    })
    .returning();
  canalId = ca!.id;

  // Ordem de inserção ao contrário da prevalência, para conferir a ordenação.
  const docs: [
    string,
    (typeof s.colecao.enumValues)[number],
    (typeof s.visibilidade.enumValues)[number],
    string[],
  ][] = [
    ["Aviso da piscina", "comunicado", "publico", ["A piscina fecha na segunda para limpeza."]],
    [
      "Regimento 2024",
      "regimento",
      "moradores",
      [
        "Preâmbulo do regimento.",
        "Art. 1º O salão exige reserva.",
        "Art. 2º Silêncio após as 22h.",
      ],
    ],
    ["Notas do síndico", "procedimento", "interno", ["Senha do portão: 1234."]],
    ["Convenção", "convencao", "moradores", ["Art. 1º Áreas comuns são de todos."]],
  ];
  for (const [titulo, colecao, visibilidade, trechos] of docs) {
    const [d] = await admin
      .insert(s.documentos)
      .values({
        tenantId,
        condominioId: condo,
        titulo,
        colecao,
        visibilidade,
        status: "treinado",
        storagePath: `x/${titulo}`,
      })
      .returning();
    await admin.insert(s.documentoTrechos).values(
      trechos.map((texto, ordem) => ({
        tenantId,
        documentoId: d!.id,
        condominioId: condo,
        ordem,
        texto,
        referencia: texto.match(/^Art\. (\d+)/)
          ? `Art. ${texto.match(/^Art\. (\d+)/)![1]}`
          : "Preâmbulo",
      })),
    );
  }
});

afterAll(async () => {
  srv.stop();
  for (const k of ["ZAPI_URL", "ANTHROPIC_BASE_URL", "ANTHROPIC_API_KEY", "ANTHROPIC_MAX_RETRIES"])
    delete process.env[k];
  await admin.delete(s.tenants).where(eq(s.tenants.id, tenantId));
});

let n = 0;
/** Mensagem do morador pelo caminho real (entrada → roteamento). Devolve o job do agente. */
async function receber(texto: string, telefone = "+5511944440000") {
  await admin.insert(s.whatsappEntradas).values({
    tenantId,
    canalId,
    telefone,
    providerMsgId: `AG-${++n}`,
    payload: { type: "ReceivedCallback", text: { message: texto } },
  });
  const job = { tenantId, canalId, telefone };
  let r: Awaited<ReturnType<typeof rotear>> | null = null;
  await processarConversa(job, async (e) => {
    r = await rotear(job, e);
  });
  return r!;
}
const conversa = (id: string) =>
  admin
    .select()
    .from(s.conversas)
    .where(eq(s.conversas.id, id))
    .then((x) => x[0]!);

beforeEach(async () => {
  falhar = false;
  durante = null;
  // Cada teste começa sem conversa aberta.
  await admin
    .update(s.conversas)
    .set({ estado: "resolvida" })
    .where(eq(s.conversas.tenantId, tenantId));
});

describe("roteamento com IA configurada", () => {
  test("condomínio definido: conversa fica com a IA, sem aviso automático, e pede o agente", async () => {
    const antes = enviados.length;
    const r = await receber("Posso fazer festa no salão sábado?");
    expect(r.agente).not.toBeNull();
    expect((await conversa(r.agente!.conversaId)).estado).toBe("ia");
    expect(enviados.length).toBe(antes);
  });

  test("urgência: vai para o síndico e não pede o agente", async () => {
    const r = await receber("cheiro de gás no corredor!");
    expect(r.agente).toBeNull();
    expect(r.alerta?.regra).toBe("gas");
  });
});

describe("contexto e prompt", () => {
  test("documentos visíveis em ordem de prevalência; interno nunca entra", async () => {
    const r = await receber("oi");
    const ctx = await withTenant(tenantId, (tx) => carregarContexto(tx, r.agente!.conversaId));
    expect(ctx!.documentos.map((d) => d.titulo)).toEqual([
      "Convenção",
      "Regimento 2024",
      "Aviso da piscina",
    ]);
    const msgs = mensagens(ctx!);
    expect(msgs[0]!.role).toBe("user");
    const blocos = msgs[0]!.content as {
      type: string;
      cache_control?: unknown;
      citations?: unknown;
    }[];
    expect(blocos.filter((b) => b.type === "document")).toHaveLength(3);
    expect(blocos[2]).toMatchObject({
      cache_control: { type: "ephemeral" },
      citations: { enabled: true },
    });
  });

  test("morador desconhecido: só documentos públicos", async () => {
    // Desconhecido com um condomínio só: o roteamento define o condomínio direto.
    const r = await receber("qual o horário da piscina?", "+5511933330000");
    const ctx = await withTenant(tenantId, (tx) => carregarContexto(tx, r.agente!.conversaId));
    expect(ctx!.morador).toBeNull();
    expect(ctx!.documentos.map((d) => d.titulo)).toEqual(["Aviso da piscina"]);
  });
});

describe("responder", () => {
  test("resposta com citação: envia com a fonte e a assinatura; uso gravado na conversa", async () => {
    const r = await receber("Até que horas posso fazer barulho?");
    resposta = { texto: "Pelo Regimento, o silêncio vale a partir das 22h.", citar: [1, 2] };
    await responder(r.agente!);

    const p = pedidos.at(-1)!;
    expect(p.system).toContain("Edifício Sol");
    const ultimo = enviados.at(-1)!;
    expect(ultimo.phone).toBe("5511944440000");
    expect(ultimo.message).toBe(
      "Pelo Regimento, o silêncio vale a partir das 22h.\n\n📄 Regimento Interno, Art. 2\n\n— OperaCondo Concierge",
    );
    const [m] = await admin
      .select()
      .from(s.mensagens)
      .where(eq(s.mensagens.conversaId, r.agente!.conversaId))
      .orderBy(desc(s.mensagens.criadoEm))
      .limit(1);
    expect(m).toMatchObject({ autor: "ia", direcao: "saida" });
    const [u] = await admin
      .select()
      .from(s.llmExecucoes)
      .where(eq(s.llmExecucoes.conversaId, r.agente!.conversaId));
    expect(u).toMatchObject({
      modelo: "claude-haiku-5-5",
      tokensSaida: 50,
      tokensCache: 4000,
      condominioId: condo,
    });
  });

  test("sem base documental: vai para o síndico com aviso ao morador; rascunho não é enviado", async () => {
    const r = await receber("Posso trocar o piso da varanda?");
    resposta = { texto: `${SEM_BASE} Olá, Bia! Vou verificar com o síndico.` };
    await responder(r.agente!);
    expect(enviados.at(-1)!.message).toBe(AVISO_SINDICO);
    expect((await conversa(r.agente!.conversaId)).estado).toBe("aguardando_sindico");
  });

  test("conversa com o síndico: a IA não chama o modelo", async () => {
    const r = await receber("bom dia");
    await admin
      .update(s.conversas)
      .set({ estado: "sindico" })
      .where(eq(s.conversas.id, r.agente!.conversaId));
    const antes = pedidos.length;
    await responder(r.agente!);
    expect(pedidos.length).toBe(antes);
  });

  test("chegou outra mensagem enquanto o modelo pensava: resposta descartada", async () => {
    const r = await receber("qual o horário da piscina?");
    resposta = { texto: "A piscina fecha na segunda.", citar: [2, 0] };
    durante = async () => {
      await receber("e no domingo?");
    };
    const antes = enviados.length;
    await responder(r.agente!);
    expect(enviados.length).toBe(antes);
  });

  test("API fora do ar: erro para a fila tentar de novo; na última tentativa vai para o síndico", async () => {
    const r = await receber("oi, tudo bem?");
    falhar = true;
    await expect(responder(r.agente!, false)).rejects.toThrow();
    expect((await conversa(r.agente!.conversaId)).estado).toBe("ia");
    await responder(r.agente!, true);
    expect((await conversa(r.agente!.conversaId)).estado).toBe("aguardando_sindico");
    expect(enviados.at(-1)!.message).toBe(AVISO_SINDICO);
  });
});
