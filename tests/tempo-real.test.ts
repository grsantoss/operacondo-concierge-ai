/** Triggers NOTIFY "eventos" → assinar(). Precisa do banco local com as migrations. */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { dbAdmin, schema as s } from "../src/server/db";
import { assinar, type Evento } from "../src/server/realtime";

const admin = dbAdmin();
let A: string, B: string, canal: string;

beforeAll(async () => {
  const ts = await admin
    .insert(s.tenants)
    .values([
      { razaoSocial: "Tempo Real A", nomeFantasia: "A" },
      { razaoSocial: "Tempo Real B", nomeFantasia: "B" },
    ])
    .returning();
  A = ts[0]!.id;
  B = ts[1]!.id;
  const [c] = await admin
    .insert(s.whatsappCanais)
    .values({ tenantId: A, phoneE164: "+5511900007777", provider: "zapi" })
    .returning();
  canal = c!.id;
});

afterAll(async () => {
  await admin.delete(s.tenants).where(eq(s.tenants.id, A));
  await admin.delete(s.tenants).where(eq(s.tenants.id, B));
});

test("conversa e mensagem nova avisam só o próprio cliente, sem conteúdo", async () => {
  const doA: Evento[] = [];
  const doB: Evento[] = [];
  const sairA = await assinar(A, (e) => doA.push(e));
  const sairB = await assinar(B, (e) => doB.push(e));
  const [cv] = await admin
    .insert(s.conversas)
    .values({ tenantId: A, canalId: canal, phoneE164: "+5511911112222" })
    .returning();
  await admin.insert(s.mensagens).values({
    tenantId: A,
    conversaId: cv!.id,
    direcao: "entrada",
    autor: "morador",
    texto: "segredo do morador",
  });
  await Bun.sleep(300);
  sairA();
  sairB();
  expect(doA.map((e) => [e.tabela, e.conversa])).toEqual([
    ["conversas", cv!.id],
    ["mensagens", cv!.id],
  ]);
  expect(JSON.stringify(doA)).not.toContain("segredo");
  expect(doB).toEqual([]);
});
