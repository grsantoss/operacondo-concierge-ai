/** Regras fixas de urgência → conversa Crítica → alerta aos síndicos. Precisa do banco local. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { cifrar } from "../src/server/cripto";
import { dbAdmin, schema as s } from "../src/server/db";
import { enviarAlerta } from "../src/server/pipeline/alerta";
import { processarConversa } from "../src/server/pipeline/processar";
import { detectarUrgencia } from "../src/server/pipeline/regras-urgencia";
import { rotear } from "../src/server/pipeline/roteamento";
import type { JobAlerta } from "../src/server/queue";

process.env.CREDENCIAIS_CHAVE ??= Buffer.alloc(32, 7).toString("base64");
const admin = dbAdmin();
const USERS = ["usr_alerta_1", "usr_alerta_2", "usr_alerta_3"];
let tenantId: string, canalId: string, condo: string;
let srv: ReturnType<typeof Bun.serve>;
const enviados: { phone: string; message: string }[] = [];
let n = 0;

describe("detectarUrgencia", () => {
  test.each([
    ["Tá com um cheiro de gás forte no 3º andar", "gas"],
    ["SOCORRO, INCÊNDIO no bloco B", "incendio"],
    ["tem fumaça saindo da lixeira", "incendio"],
    ["Minha mãe está presa no elevador social", "elevador"],
    ["o elevador parou e tem gente trancada", "elevador"],
    ["Vazamento enorme na garagem, tá alagado", "vazamento"],
    ["vazamento de gás na cozinha", "gas"],
  ])("%s → %s", (texto, id) => {
    expect(detectarUrgencia(texto)?.id).toBe(id as never);
  });

  test.each([
    "Bom dia, qual o horário da piscina?",
    "o fogão novo chegou",
    "elevador está lento",
    null,
  ])("%s → nada", (texto) => {
    expect(detectarUrgencia(texto)).toBeNull();
  });
});

describe("alerta", () => {
  beforeAll(async () => {
    srv = Bun.serve({
      port: 0,
      async fetch(req) {
        enviados.push((await req.json()) as { phone: string; message: string });
        return Response.json({ messageId: `OUT-${enviados.length}-${Date.now()}` });
      },
    });
    process.env.ZAPI_URL = `http://localhost:${srv.port}`;
    const [t] = await admin
      .insert(s.tenants)
      .values({ razaoSocial: "Teste Alerta", nomeFantasia: "Teste Alerta" })
      .returning();
    tenantId = t!.id;
    const cs = await admin
      .insert(s.condominios)
      .values([
        { tenantId, nome: "Edifício Sol", tipo: "vertical" },
        { tenantId, nome: "Edifício Lua", tipo: "vertical" },
      ])
      .returning();
    condo = cs[0]!.id;
    const [m] = await admin
      .insert(s.moradores)
      .values({ tenantId, condominioId: condo, nome: "Bia", cadastro: "aprovado" })
      .returning();
    await admin
      .insert(s.moradorContatos)
      .values({ tenantId, moradorId: m!.id, condominioId: condo, phoneE164: "+5511944440000" });
    await admin
      .insert(s.user)
      .values(USERS.map((id) => ({ id, name: id, email: `${id}@teste.local` })));
    await admin.insert(s.membros).values([
      // recebe: síndico de todos os condomínios
      { tenantId, userId: USERS[0]!, papel: "sindico", alertaE164: "+5511955550000" },
      // não recebe: só cuida do Edifício Lua
      {
        tenantId,
        userId: USERS[1]!,
        papel: "sindico",
        alertaE164: "+5511966660000",
        condominioIds: [cs[1]!.id],
      },
      // não recebe: conselho
      { tenantId, userId: USERS[2]!, papel: "conselho", alertaE164: "+5511977770000" },
    ]);
    const [c] = await admin
      .insert(s.whatsappCanais)
      .values({
        tenantId,
        phoneE164: "+5511900009999",
        provider: "zapi",
        instanceId: "INST-ALERTA",
        credenciaisCifradas: cifrar(JSON.stringify({ token: "tok" })),
      })
      .returning();
    canalId = c!.id;
  });

  afterAll(async () => {
    srv.stop();
    delete process.env.ZAPI_URL;
    await admin.delete(s.tenants).where(eq(s.tenants.id, tenantId));
    await admin.delete(s.user).where(inArray(s.user.id, USERS));
  });

  async function receber(telefone: string, texto: string) {
    await admin.insert(s.whatsappEntradas).values({
      tenantId,
      canalId,
      telefone,
      providerMsgId: `AL-${++n}`,
      payload: { type: "ReceivedCallback", text: { message: texto } },
    });
    const job = { tenantId, canalId, telefone };
    let alerta: JobAlerta | null = null;
    await processarConversa(job, async (e) => {
      alerta = (await rotear(job, e)).alerta;
    });
    return alerta as JobAlerta | null;
  }

  test("mensagem comum não alerta", async () => {
    expect(await receber("+5511944440000", "Bom dia")).toBeNull();
  });

  test("gás: conversa vira Crítica e só o síndico do condomínio recebe", async () => {
    const alerta = await receber("+5511944440000", "Socorro, cheiro de gás na cozinha!");
    expect(alerta).toMatchObject({ tenantId, regra: "gas" });
    const [cv] = await admin
      .select()
      .from(s.conversas)
      .where(eq(s.conversas.id, alerta!.conversaId));
    expect(cv!.prioridade).toBe("critica");

    const antes = enviados.length;
    expect(await enviarAlerta(alerta!)).toBe(1);
    const novos = enviados.slice(antes);
    expect(novos.map((e) => e.phone)).toEqual(["5511955550000"]);
    expect(novos[0]!.message).toContain("Vazamento de gás");
    expect(novos[0]!.message).toContain("Edifício Sol");
    expect(novos[0]!.message).toContain("cheiro de gás");
  });

  test("vazamento depois não rebaixa a urgência", async () => {
    const alerta = await receber("+5511944440000", "e agora tem vazamento de água também");
    expect(alerta!.regra).toBe("vazamento");
    const [cv] = await admin
      .select()
      .from(s.conversas)
      .where(eq(s.conversas.id, alerta!.conversaId));
    expect(cv!.prioridade).toBe("critica");
  });

  test("número desconhecido, sem condomínio definido: alerta todos os síndicos", async () => {
    const alerta = await receber("+5511988880000", "pegando fogo no salão de festas");
    expect(alerta?.regra).toBe("incendio");
    // Sem condomínio definido, avisa todos os síndicos com número (não dá para filtrar).
    expect(await enviarAlerta(alerta!)).toBe(2);
    expect(enviados.at(-1)!.message).toContain("Condomínio ainda não definido");
  });
});
