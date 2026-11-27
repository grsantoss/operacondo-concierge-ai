/** Núcleo do agente: contexto, prompt com documentos em cache, citações e escalonamento. Banco local. */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { desc, eq, sql } from "drizzle-orm";
import { carregarContexto } from "../src/server/agent/contexto";
import { mensagens, SEM_BASE } from "../src/server/agent/prompt";
import { AVISO_SINDICO } from "../src/server/agent/guardrails";
import { responder } from "../src/server/agent/run";
import { acharUnidade } from "../src/server/agent/tools";
import { ATENDIMENTO_INDISPONIVEL, exigirLimite } from "../src/server/billing/limites";
import { avaliarRascunho } from "../src/lib/conversas.functions";
import { cifrar } from "../src/server/cripto";
import { dbAdmin, schema as s, withTenant } from "../src/server/db";
import { processarConversa } from "../src/server/pipeline/processar";
import { rotear } from "../src/server/pipeline/roteamento";
import { enviarNaConversa } from "../src/server/whatsapp/send";

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
/** E-mails brutos (MIME) recebidos pela SES falsa. */
const emails: string[] = [];
type Texto = { texto: string; citar?: [number, number]; citarBusca?: boolean };
let resposta: Texto = { texto: "" };
/** Respostas em ordem (antes de `resposta`): pedido de ferramenta ou texto final. */
const roteiro: (Texto | { ferramenta: string; entrada: unknown })[] = [];
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
      if (u.pathname === "/v2/email/outbound-emails") {
        const b = (await req.json()) as { Content: { Raw: { Data: string } } };
        emails.push(Buffer.from(b.Content.Raw.Data, "base64").toString("utf8"));
        return Response.json({ MessageId: `SES-${emails.length}-${Date.now()}` });
      }
      if (u.pathname === "/v1/messages") {
        if (falhar)
          return Response.json(
            { type: "error", error: { type: "api_error", message: "fora" } },
            { status: 500 },
          );
        const pedido = (await req.json()) as Pedido;
        pedidos.push(pedido);
        await durante?.();
        const passo = roteiro.shift();
        if (passo && "ferramenta" in passo)
          return Response.json({
            id: "msg_tool",
            type: "message",
            role: "assistant",
            model: "claude-haiku-5-5",
            content: [
              {
                type: "tool_use",
                id: `tu_${pedidos.length}`,
                name: passo.ferramenta,
                input: passo.entrada,
              },
            ],
            stop_reason: "tool_use",
            stop_sequence: null,
            usage: { input_tokens: 100, output_tokens: 20 },
          });
        const atual = passo ?? resposta;
        // Cita o 1º resultado de buscar_regras que veio no último tool_result.
        const busca = atual.citarBusca
          ? (pedido.messages.at(-1)!.content as { type: string; content?: unknown }[])
              .flatMap((b) =>
                b.type === "tool_result" ? (b.content as { title: string; source: string }[]) : [],
              )
              .at(0)
          : undefined;
        if (busca)
          return Response.json({
            id: "msg_busca",
            type: "message",
            role: "assistant",
            model: "claude-haiku-5-5",
            content: [
              {
                type: "text",
                text: atual.texto,
                citations: [
                  {
                    type: "search_result_location",
                    cited_text: "…",
                    search_result_index: 0,
                    source: busca.source,
                    title: busca.title,
                    start_block_index: 0,
                    end_block_index: 1,
                  },
                ],
              },
            ],
            stop_reason: "end_turn",
            stop_sequence: null,
            usage: { input_tokens: 100, output_tokens: 20 },
          });
        const [doc, bloco] = atual.citar ?? [];
        return Response.json({
          id: "msg_teste",
          type: "message",
          role: "assistant",
          model: "claude-haiku-5-5",
          content: [
            {
              type: "text",
              text: atual.texto,
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
    SES_URL: base,
    SES_ACCESS_KEY: "teste",
    SES_SECRET_KEY: "teste",
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
  for (const k of [
    "ZAPI_URL",
    "SES_URL",
    "SES_ACCESS_KEY",
    "SES_SECRET_KEY",
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_MAX_RETRIES",
  ])
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
  roteiro.length = 0;
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

  test("e-mail: nada é enviado; a resposta com a fonte vira rascunho e conta na cota", async () => {
    const [canal] = await admin
      .insert(s.emailCanais)
      .values({ tenantId, endereco: `sol-${Date.now()}@atendimento.operacondo.local` })
      .onConflictDoNothing()
      .returning();
    const canalEmail =
      canal ??
      (await admin.select().from(s.emailCanais).where(eq(s.emailCanais.tenantId, tenantId)))[0]!;
    const [cv] = await admin
      .insert(s.conversas)
      .values({
        tenantId,
        canal: "email",
        emailCanalId: canalEmail.id,
        endereco: "bia@exemplo.com",
        condominioId: condo,
        moradorId,
        estado: "ia",
      })
      .returning();
    await admin.insert(s.mensagens).values({
      tenantId,
      conversaId: cv!.id,
      direcao: "entrada",
      autor: "morador",
      texto: "Até que horas posso fazer barulho?",
      assunto: "Dúvida sobre barulho",
      messageId: "<pergunta-1@exemplo.com>",
    });
    const uso = () =>
      withTenant(tenantId, (tx) =>
        tx.execute<{ n: number }>(sql`select respostas_ia::int as n from uso_mensal`),
      ).then((r) => r.rows[0]!.n);
    const antesUso = await uso();
    const antes = enviados.length;
    resposta = { texto: "Olá, Bia,\n\nO silêncio vale a partir das 22h.", citar: [1, 2] };
    await responder({ tenantId, conversaId: cv!.id });

    const p = pedidos.at(-1)!;
    expect(p.system).toContain("assistente de e-mail");
    expect(p.system).toContain("[fornecedor]");
    expect(JSON.stringify(p.messages)).toContain("Assunto: Dúvida sobre barulho");
    expect(enviados.length).toBe(antes);
    expect(await conversa(cv!.id)).toMatchObject({
      estado: "aguardando_sindico",
      rascunhoMotivo: "Resposta por e-mail aguardando aprovação",
      rascunho:
        "Olá, Bia,\n\nO silêncio vale a partir das 22h.\n\n📄 Regimento Interno, Art. 2\n\n— OperaCondo Concierge",
    });
    expect(await uso()).toBe(antesUso + 1);

    // "Aprovar e enviar": sai pela SES na mesma thread, do endereço de atendimento do cliente.
    const rascunho = (await conversa(cv!.id)).rascunho!;
    await withTenant(tenantId, (tx) => enviarNaConversa(tx, cv!, rascunho, "sindico", "aprovado"));
    const bruto = emails.at(-1)!;
    expect(bruto).toContain(
      `From: =?UTF-8?B?${Buffer.from("Edifício Sol").toString("base64")}?= <${canalEmail.endereco}>`,
    );
    expect(bruto).toContain("To: bia@exemplo.com");
    expect(bruto).toContain(
      `Subject: =?UTF-8?B?${Buffer.from("Re: Dúvida sobre barulho").toString("base64")}?=`,
    );
    expect(bruto).toContain("In-Reply-To: <pergunta-1@exemplo.com>");
    expect(bruto).toContain("References: <pergunta-1@exemplo.com>");
    expect(bruto).toContain("Content-Type: text/html");
    const [saida] = await admin
      .select()
      .from(s.mensagens)
      .where(eq(s.mensagens.conversaId, cv!.id))
      .orderBy(desc(s.mensagens.criadoEm))
      .limit(1);
    expect(saida).toMatchObject({
      direcao: "saida",
      autor: "sindico",
      assunto: "Re: Dúvida sobre barulho",
      inReplyTo: "<pergunta-1@exemplo.com>",
      avaliacaoRascunho: "aprovado",
    });
    expect(saida!.messageId).toMatch(/^<.+@atendimento\.operacondo\.local>$/);
    expect(saida!.providerMsgId).toMatch(/^SES-/);
  });

  test("e-mail com envio automático ligado: resposta com base sai sem aprovação", async () => {
    await admin
      .insert(s.agenteConfig)
      .values({ tenantId, condominioId: condo, opcoes: { emailAutomatico: true } })
      .onConflictDoUpdate({
        target: s.agenteConfig.condominioId,
        set: { opcoes: { emailAutomatico: true } },
      });
    const [canalEmail] = await admin
      .select()
      .from(s.emailCanais)
      .where(eq(s.emailCanais.tenantId, tenantId));
    const [cv] = await admin
      .insert(s.conversas)
      .values({
        tenantId,
        canal: "email",
        emailCanalId: canalEmail!.id,
        endereco: "bia2@exemplo.com",
        condominioId: condo,
        moradorId,
        estado: "ia",
      })
      .returning();
    await admin.insert(s.mensagens).values({
      tenantId,
      conversaId: cv!.id,
      direcao: "entrada",
      autor: "morador",
      texto: "Até que horas posso fazer barulho?",
    });
    const antes = emails.length;
    resposta = { texto: "Olá, Bia,\n\nO silêncio vale a partir das 22h.", citar: [1, 2] };
    try {
      await responder({ tenantId, conversaId: cv!.id });
    } finally {
      await admin.delete(s.agenteConfig).where(eq(s.agenteConfig.condominioId, condo));
    }
    expect(emails.length).toBe(antes + 1);
    expect(emails.at(-1)).toContain(
      `Subject: =?UTF-8?B?${Buffer.from("Resposta da administração do condomínio").toString("base64")}?=`,
    );
    expect(await conversa(cv!.id)).toMatchObject({ estado: "ia", rascunho: null });
  });

  test("sem base documental: vai para o síndico com aviso ao morador; rascunho não é enviado", async () => {
    const r = await receber("Posso trocar o piso da varanda?");
    resposta = { texto: `${SEM_BASE} Olá, Bia! Vou verificar com o síndico.` };
    await responder(r.agente!);
    expect(enviados.at(-1)!.message).toBe(AVISO_SINDICO);
    expect(await conversa(r.agente!.conversaId)).toMatchObject({
      estado: "aguardando_sindico",
      rascunho: "Olá, Bia! Vou verificar com o síndico.",
      rascunhoMotivo: "Sem base documental",
    });
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

describe("limites do plano", () => {
  test("inadimplência: parcial não chama o modelo; congelado responde só a mensagem fixa", async () => {
    const suspender = (suspensao: "nenhuma" | "parcial" | "integral") =>
      admin.update(s.tenants).set({ suspensao }).where(eq(s.tenants.id, tenantId));
    try {
      await suspender("parcial");
      const r = await receber("a academia abre domingo?");
      const antes = pedidos.length;
      await responder(r.agente!);
      expect(pedidos.length).toBe(antes);
      expect(enviados.at(-1)!.message).toBe(AVISO_SINDICO);

      await suspender("integral");
      const c = await receber("oi, preciso de ajuda");
      expect(c.agente).toBeNull();
      expect(enviados.at(-1)!.message).toBe(ATENDIMENTO_INDISPONIVEL);
      // Urgência continua alertando o síndico.
      expect((await receber("cheiro de gás no hall!")).alerta?.regra).toBe("gas");
    } finally {
      await suspender("nenhuma");
    }
  });

  test("teto do mês atingido: nenhuma chamada ao modelo, aviso fixo e conversa com o síndico", async () => {
    // Trial: limites do plano `trial` (teto de custo de R$ 15); US$ 50 passa do teto.
    const [a] = await admin
      .insert(s.assinaturas)
      .values({ tenantId, planoId: "essencial", status: "trialing", formaCobranca: "cartao" })
      .returning();
    const [l] = await admin
      .insert(s.llmExecucoes)
      .values({ tenantId, modelo: "teste", custoUsd: 50 })
      .returning();
    try {
      const r = await receber("posso usar a churrasqueira?");
      const antes = pedidos.length;
      await responder(r.agente!);
      expect(pedidos.length).toBe(antes);
      expect(enviados.at(-1)!.message).toBe(AVISO_SINDICO);
      expect(await conversa(r.agente!.conversaId)).toMatchObject({
        estado: "aguardando_sindico",
        rascunhoMotivo: "Teto de custo da IA do mês atingido",
      });
      // Cadastro acima do limite do trial (50 moradores) é bloqueado.
      await expect(withTenant(tenantId, (tx) => exigirLimite(tx, "moradores", 50))).rejects.toThrow(
        "O plano permite até 50 moradores",
      );
      await withTenant(tenantId, (tx) => exigirLimite(tx, "moradores", 1));
    } finally {
      await admin.delete(s.llmExecucoes).where(eq(s.llmExecucoes.id, l!.id));
      await admin.delete(s.assinaturas).where(eq(s.assinaturas.id, a!.id));
    }
  });
});

describe("ferramentas", () => {
  const ultimaDemanda = () =>
    admin
      .select()
      .from(s.demandas)
      .where(eq(s.demandas.tenantId, tenantId))
      .orderBy(desc(s.demandas.criadoEm))
      .limit(1)
      .then((x) => x[0]!);

  test("abrir_demanda: grava com a conversa; acima do limite vai para análise; resultado volta ao modelo", async () => {
    const r = await receber("A bomba da piscina quebrou, o técnico cobrou R$ 900");
    roteiro.push(
      {
        ferramenta: "abrir_demanda",
        entrada: {
          titulo: "Bomba da piscina quebrada",
          descricao: "Morador relata bomba quebrada; orçamento do técnico R$ 900.",
          categoria: "manutencao",
          prioridade: "normal",
          local: "Piscina",
          custo_estimado: 900,
          // O modelo não escolhe cliente nem condomínio: campos extras são ignorados.
          condominio_id: "00000000-0000-0000-0000-000000000000",
        },
      },
      { texto: "Abri a demanda e o síndico vai analisar o orçamento." },
    );
    await responder(r.agente!);
    const d = await ultimaDemanda();
    expect(d).toMatchObject({
      conversaId: r.agente!.conversaId,
      condominioId: condo,
      moradorId,
      coluna: "triagem",
      custoEstimado: 900,
    });
    const resultado = JSON.stringify(pedidos.at(-1)!.messages.at(-1));
    expect(resultado).toContain(`Demanda ${d.codigo} aberta`);
    expect(enviados.at(-1)!.message).toStartWith("Abri a demanda");
    // Próxima resposta sabe que a demanda já existe.
    const ctx = await withTenant(tenantId, (tx) => carregarContexto(tx, r.agente!.conversaId));
    expect(ctx!.demandas.map((x) => x.codigo)).toEqual([d.codigo]);
  });

  test("registrar_cadastro: número novo vira morador pendente, com unidade, contato e aceite", async () => {
    await admin.insert(s.unidades).values([
      { tenantId, condominioId: condo, bloco: "A", apto: "302" },
      { tenantId, condominioId: condo, bloco: "B", apto: "302" },
    ]);
    const r = await receber("Oi, moro aqui e quero me cadastrar", "+5511922220000");
    roteiro.push(
      {
        ferramenta: "registrar_cadastro",
        entrada: {
          nome: "Caio Lima",
          unidade: "Bloco B, apto 302",
          vinculo: "locatario",
          aceite_lgpd: true,
        },
      },
      { texto: "Pronto, Caio! O síndico vai conferir seu cadastro." },
    );
    await responder(r.agente!);
    const [m] = await admin
      .select({ m: s.moradores, u: s.unidades })
      .from(s.moradores)
      .innerJoin(s.unidades, eq(s.unidades.id, s.moradores.unidadeId))
      .where(eq(s.moradores.nome, "Caio Lima"));
    expect(m).toMatchObject({
      m: { cadastro: "pendente", status: "locatario", unidadeInformada: "Bloco B, apto 302" },
      u: { bloco: "B", apto: "302" },
    });
    expect((await conversa(r.agente!.conversaId)).moradorId).toBe(m!.m.id);
    const [aceite] = await admin
      .select()
      .from(s.consentimentos)
      .where(eq(s.consentimentos.phoneE164, "+5511922220000"));
    expect(aceite).toBeDefined();
  });

  test("registrar_cadastro no e-mail: grava o e-mail do morador e o aceite por e-mail", async () => {
    const [canalEmail] = await admin
      .select()
      .from(s.emailCanais)
      .where(eq(s.emailCanais.tenantId, tenantId));
    const [cv] = await admin
      .insert(s.conversas)
      .values({
        tenantId,
        canal: "email",
        emailCanalId: canalEmail!.id,
        endereco: "davi@exemplo.com",
        condominioId: condo,
        estado: "ia",
      })
      .returning();
    await admin.insert(s.mensagens).values({
      tenantId,
      conversaId: cv!.id,
      direcao: "entrada",
      autor: "morador",
      texto: "Moro no A 302 e quero me cadastrar.",
    });
    roteiro.push(
      {
        ferramenta: "registrar_cadastro",
        entrada: { nome: "Davi Rocha", unidade: "A 302", vinculo: "residente", aceite_lgpd: true },
      },
      { texto: "Olá, Davi,\n\nSeu cadastro foi registrado e o síndico vai conferir." },
    );
    await responder({ tenantId, conversaId: cv!.id });
    const [m] = await admin.select().from(s.moradores).where(eq(s.moradores.nome, "Davi Rocha"));
    expect(m).toMatchObject({ cadastro: "pendente", email: "davi@exemplo.com" });
    expect(await admin.$count(s.moradorContatos, eq(s.moradorContatos.moradorId, m!.id))).toBe(0);
    const [aceite] = await admin
      .select()
      .from(s.consentimentos)
      .where(eq(s.consentimentos.email, "davi@exemplo.com"));
    expect(aceite).toMatchObject({ finalidade: "atendimento_email", textoVersao: "email-v1" });
  });

  test("registrar_cadastro sem aceite: o SDK recusa a entrada e nada é gravado", async () => {
    const r = await receber("quero cadastro", "+5511911110000");
    roteiro.push(
      {
        ferramenta: "registrar_cadastro",
        entrada: { nome: "Sem Aceite", unidade: "A 302", vinculo: "residente", aceite_lgpd: false },
      },
      { texto: "Preciso do seu aceite para continuar." },
    );
    await responder(r.agente!);
    const nada = await admin.select().from(s.moradores).where(eq(s.moradores.nome, "Sem Aceite"));
    expect(nada).toHaveLength(0);
    expect(JSON.stringify(pedidos.at(-1)!.messages.at(-1))).toContain("is_error");
  });

  test("escalar_sindico: o aviso escrito pelo modelo vai ao morador e a conversa ao síndico", async () => {
    const r = await receber("O vizinho de cima faz barulho toda noite, quero falar com o síndico");
    roteiro.push(
      { ferramenta: "escalar_sindico", entrada: { motivo: "Reclamação de vizinho" } },
      { texto: "Vou passar para o síndico, que responde por aqui." },
    );
    await responder(r.agente!);
    expect(await conversa(r.agente!.conversaId)).toMatchObject({
      estado: "aguardando_sindico",
      rascunho: null,
      rascunhoMotivo: "Reclamação de vizinho",
    });
    expect(enviados.at(-1)!.message).toStartWith("Vou passar para o síndico");
  });

  test("buscar_regras: só documentos visíveis; a fonte vem do resultado citado", async () => {
    const r = await receber("tem regra de silêncio?");
    roteiro.push(
      { ferramenta: "buscar_regras", entrada: { consulta: "silêncio" } },
      { texto: "Sim, silêncio após as 22h.", citarBusca: true },
    );
    await responder(r.agente!);
    expect(enviados.at(-1)!.message).toContain("📄 Regimento Interno, Art. 2");

    // Interno nunca aparece, nem pela busca.
    const r2 = await receber("qual a senha do portão?");
    roteiro.push(
      { ferramenta: "buscar_regras", entrada: { consulta: "senha portão" } },
      { texto: `${SEM_BASE} rascunho` },
    );
    await responder(r2.agente!);
    expect(JSON.stringify(pedidos.at(-1)!.messages.at(-1))).toContain("Nenhum trecho encontrado");
  });

  test("minhas_demandas e atualizar_demanda: só as demandas do próprio morador", async () => {
    const minha = await ultimaDemanda();
    const r = await receber("como está minha demanda?");
    roteiro.push(
      { ferramenta: "minhas_demandas", entrada: {} },
      {
        ferramenta: "atualizar_demanda",
        entrada: { codigo: minha.codigo, comentario: "Agora vaza mais." },
      },
      { ferramenta: "atualizar_demanda", entrada: { codigo: "D-1", comentario: "outra" } },
      { texto: "Anotei na sua demanda." },
    );
    await responder(r.agente!);
    const resultados = pedidos.slice(-3).map((p) => JSON.stringify(p.messages.at(-1)));
    expect(resultados[0]).toContain(minha.codigo);
    expect(resultados[1]).toContain(`Comentário registrado na ${minha.codigo}`);
    expect(resultados[2]).toContain("Não achei a demanda D-1");
    const [ev] = await admin
      .select()
      .from(s.demandaEventos)
      .where(eq(s.demandaEventos.demandaId, minha.id))
      .orderBy(desc(s.demandaEventos.em))
      .limit(1);
    expect(ev).toMatchObject({ detalhe: "Agora vaza mais.", canal: "whatsapp" });
  });
});

test("acharUnidade: só casa quando há uma unidade inequívoca", () => {
  const u = (bloco: string | null, apto: string) =>
    ({ id: `${bloco}${apto}`, bloco, apto, quadra: null, casa: null }) as never;
  const lista = [u("A", "302"), u("B", "302"), u(null, "15")];
  expect(acharUnidade("Bloco B, apto 302", lista)).toMatchObject({ bloco: "B" });
  expect(acharUnidade("b302", lista)).toMatchObject({ bloco: "B" });
  expect(acharUnidade("apto 302", lista)).toBeNull();
  expect(acharUnidade("15", lista)).toMatchObject({ apto: "15" });
});

test("LGPD: CPF e telefone escritos pelo morador não chegam ao Claude", async () => {
  await admin
    .update(s.conversas)
    .set({ estado: "resolvida" })
    .where(eq(s.conversas.tenantId, tenantId));
  const r = await receber("Meu CPF é 529.982.247-25 e meu outro número é (11) 98123-0506");
  resposta = { texto: "Obrigado!" };
  await responder(r.agente!);
  const pedido = JSON.stringify(pedidos.at(-1));
  expect(pedido).not.toContain("529.982.247-25");
  expect(pedido).not.toContain("98123-0506");
  expect(pedido).toContain("Meu CPF é [CPF] e meu outro número é [telefone]");
});

test("nota do rascunho: aprovado, editado ou reescrito", () => {
  const r = "Olá, Bia! A reforma da varanda precisa de autorização do síndico.";
  expect(
    avaliarRascunho(r, "  Olá, Bia!  A reforma da varanda precisa de autorização do síndico. "),
  ).toBe("aprovado");
  expect(
    avaliarRascunho(r, "Oi, Bia! A reforma da varanda precisa de autorização prévia do síndico."),
  ).toBe("editado");
  expect(avaliarRascunho(r, "Pode fazer, só avise a portaria antes.")).toBe("reescrito");
});
