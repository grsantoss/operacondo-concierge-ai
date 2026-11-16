/** Roteamento: telefone → condomínio, menu, gravação das mensagens. Precisa do banco local. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq, sql } from "drizzle-orm";
import { cifrar } from "../src/server/cripto";
import { dbAdmin, schema as s } from "../src/server/db";
import { processarConversa } from "../src/server/pipeline/processar";
import { escolherCondominio, rotear } from "../src/server/pipeline/roteamento";

process.env.CREDENCIAIS_CHAVE ??= Buffer.alloc(32, 7).toString("base64");
const admin = dbAdmin();
const CONHECIDO = "+5511911110000";
const DESCONHECIDO = "+5511922220000";
const FORA_DO_AR = "+5511933330000";
let tenantId: string, canalId: string, alfa: string, beta: string, moradorId: string;
let srv: ReturnType<typeof Bun.serve>;
const enviados: { phone: string; message: string }[] = [];
let n = 0;

async function receber(telefone: string, texto: string) {
  await admin.insert(s.whatsappEntradas).values({
    tenantId,
    canalId,
    telefone,
    providerMsgId: `T-${++n}`,
    payload: { type: "ReceivedCallback", phone: telefone.slice(1), text: { message: texto } },
  });
  const job = { tenantId, canalId, telefone };
  return processarConversa(job, (e) => rotear(job, e));
}
const conversa = async (tel: string) =>
  (
    await admin
      .select()
      .from(s.conversas)
      .where(and(eq(s.conversas.canalId, canalId), eq(s.conversas.phoneE164, tel)))
  )[0];
const mensagens = async (conversaId: string) =>
  admin
    .select()
    .from(s.mensagens)
    .where(eq(s.mensagens.conversaId, conversaId))
    .orderBy(s.mensagens.criadoEm);

beforeAll(async () => {
  srv = Bun.serve({
    port: 0,
    async fetch(req) {
      const corpo = (await req.json()) as { phone: string; message: string };
      if (corpo.phone === FORA_DO_AR.slice(1)) return new Response("erro", { status: 500 });
      enviados.push(corpo);
      return Response.json({ messageId: `OUT-${enviados.length}-${Date.now()}` });
    },
  });
  process.env.ZAPI_URL = `http://localhost:${srv.port}`;
  const [t] = await admin
    .insert(s.tenants)
    .values({ razaoSocial: "Teste Rota", nomeFantasia: "Teste Rota" })
    .returning();
  tenantId = t!.id;
  const condos = await admin
    .insert(s.condominios)
    .values([
      { tenantId, nome: "Residencial Beta", tipo: "horizontal" },
      { tenantId, nome: "Edifício Alfa", tipo: "vertical" },
    ])
    .returning();
  beta = condos[0]!.id;
  alfa = condos[1]!.id;
  const [m] = await admin
    .insert(s.moradores)
    .values({ tenantId, condominioId: alfa, nome: "Ana", cadastro: "aprovado" })
    .returning();
  moradorId = m!.id;
  await admin
    .insert(s.moradorContatos)
    .values({ tenantId, moradorId, condominioId: alfa, phoneE164: CONHECIDO });
  const [c] = await admin
    .insert(s.whatsappCanais)
    .values({
      tenantId,
      phoneE164: "+5511900005678",
      provider: "zapi",
      instanceId: "INST-ROTA",
      credenciaisCifradas: cifrar(JSON.stringify({ token: "tok" })),
    })
    .returning();
  canalId = c!.id;
});

afterAll(async () => {
  srv.stop();
  delete process.env.ZAPI_URL;
  await admin.delete(s.tenants).where(eq(s.tenants.id, tenantId));
});

describe("escolherCondominio", () => {
  const ops = [{ nome: "Edifício Alfa" }, { nome: "Residencial Beta" }];
  test("número, nome sem acento, ambíguo/fora", () => {
    expect(escolherCondominio(" 2 ", ops)?.nome).toBe("Residencial Beta");
    expect(escolherCondominio("sou do edificio alfa", ops)?.nome).toBe("Edifício Alfa");
    expect(escolherCondominio("3", ops)).toBeNull();
    expect(escolherCondominio("bom dia", ops)).toBeNull();
  });
});

describe("roteamento", () => {
  test("morador conhecido com 1 condomínio: segue direto e o síndico é avisado", async () => {
    expect(await receber(CONHECIDO, "Tem vazamento na garagem")).toBe(1);
    const c = await conversa(CONHECIDO);
    expect(c).toMatchObject({ condominioId: alfa, moradorId, estado: "aguardando_sindico" });
    const ms = await mensagens(c!.id);
    expect(ms.map((m) => [m.direcao, m.autor])).toEqual([
      ["entrada", "morador"],
      ["saida", "sistema"],
    ]);
    expect(ms[0]!.texto).toBe("Tem vazamento na garagem");
    expect(enviados.at(-1)).toMatchObject({ phone: "5511911110000" });
    expect(enviados.at(-1)!.message).toContain("Edifício Alfa");
  });

  test("nova mensagem cai na mesma conversa, sem repetir o aviso", async () => {
    const antes = enviados.length;
    await receber(CONHECIDO, "É no subsolo 2");
    expect(enviados.length).toBe(antes);
    expect(await mensagens((await conversa(CONHECIDO))!.id)).toHaveLength(3);
  });

  test("número desconhecido: menu com os condomínios do cliente; a resposta define", async () => {
    await receber(DESCONHECIDO, "Bom dia");
    let c = await conversa(DESCONHECIDO);
    expect(c!.condominioId).toBeNull();
    expect(enviados.at(-1)!.message).toContain("1. Edifício Alfa\n2. Residencial Beta");

    await receber(DESCONHECIDO, "2");
    c = await conversa(DESCONHECIDO);
    expect(c).toMatchObject({ condominioId: beta, moradorId: null, estado: "aguardando_sindico" });
    expect(enviados.at(-1)!.message).toContain("Residencial Beta");
    expect(await mensagens(c!.id)).toHaveLength(4); // Bom dia, menu, 2, aviso
  });

  test("Z-API fora do ar: nada gravado, entrada continua pendente para a nova tentativa", async () => {
    await expect(receber(FORA_DO_AR, "Oi")).rejects.toThrow();
    await Bun.sleep(100);
    expect(await conversa(FORA_DO_AR)).toBeUndefined();
    const { rows } = await admin.execute<{ n: number }>(
      sql`select count(*)::int as n from whatsapp_entradas where telefone = ${FORA_DO_AR} and processado_em is null and canal_id = ${canalId}`,
    );
    expect(rows[0]!.n).toBe(1);
  });
});
