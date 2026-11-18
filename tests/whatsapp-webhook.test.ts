/** Webhook da Z-API → whatsapp_entradas → fila. Precisa do banco local com as migrations. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { hashSegredo } from "../src/server/cripto";
import { dbAdmin, schema as s } from "../src/server/db";
import { processarConversa } from "../src/server/pipeline/processar";
import { pararFila } from "../src/server/queue";
import { receberWebhookZapi } from "../src/server/whatsapp/webhook";

const admin = dbAdmin();
const SEGREDO = "segredo-de-teste-webhook";
let tenantId: string;
let canalId: string;

const msg = (extra: Record<string, unknown> = {}) => ({
  type: "ReceivedCallback",
  instanceId: "INST-WEBHOOK",
  messageId: "MSG-1",
  phone: "5511977776666",
  fromMe: false,
  isGroup: false,
  momment: 1763300000000,
  text: { message: "Oi, tem vazamento na garagem" },
  ...extra,
});
const post = (corpo: unknown, segredo = SEGREDO) =>
  receberWebhookZapi(
    segredo,
    new Request("http://x/api/whatsapp/zapi/" + segredo, {
      method: "POST",
      body: JSON.stringify(corpo),
    }),
  );
const entradas = () =>
  admin.select().from(s.whatsappEntradas).where(eq(s.whatsappEntradas.canalId, canalId));
const jobs = async () =>
  (
    await admin.execute<{ n: number }>(
      sql`select count(*)::int as n from pgboss.job where name = 'mensagem' and singleton_key = ${`${canalId}:+5511977776666`}`,
    )
  ).rows[0]!.n;

beforeAll(async () => {
  const [t] = await admin
    .insert(s.tenants)
    .values({ razaoSocial: "Teste Webhook", nomeFantasia: "Teste Webhook" })
    .returning();
  tenantId = t!.id;
  const [c] = await admin
    .insert(s.whatsappCanais)
    .values({
      tenantId,
      phoneE164: "+5511900001234",
      provider: "zapi",
      instanceId: "INST-WEBHOOK",
      webhookHash: hashSegredo(SEGREDO),
    })
    .returning();
  canalId = c!.id;
});

afterAll(async () => {
  await admin.execute(sql`delete from pgboss.job where singleton_key like ${canalId + ":%"}`);
  await admin.delete(s.tenants).where(eq(s.tenants.id, tenantId));
  await pararFila(false);
});

describe("webhook Z-API", () => {
  test("segredo errado → 404; instância errada → 403", async () => {
    expect((await post(msg(), "outro-segredo")).status).toBe(404);
    expect((await post(msg({ instanceId: "OUTRA" }))).status).toBe(403);
    expect(await entradas()).toHaveLength(0);
  });

  test("ignora (200) o que não é mensagem de morador", async () => {
    for (const extra of [
      { fromMe: true },
      { isGroup: true, phone: "120363019502650977-group" },
      { type: "MessageStatusCallback" },
    ]) {
      const r = await post(msg({ ...extra, messageId: "IGN" }));
      expect(r.status).toBe(200);
      expect(((await r.json()) as { ignorado?: string }).ignorado).toBeTruthy();
    }
    expect(await entradas()).toHaveLength(0);
  });

  test("grava, deduplica pelo messageId e agrupa num job por conversa", async () => {
    expect((await post(msg())).status).toBe(200);
    expect((await post(msg())).status).toBe(200); // reentrega da Z-API
    expect((await post(msg({ messageId: "MSG-2", text: { message: "Bloco B" } }))).status).toBe(
      200,
    );
    const e = await entradas();
    expect(e.map((x) => x.providerMsgId).sort()).toEqual(["MSG-1", "MSG-2"]);
    expect(e[0]!.telefone).toBe("+5511977776666");
    expect(await jobs()).toBe(1);
  });

  test("worker processa as entradas pendentes uma vez", async () => {
    const job = { tenantId, canalId, telefone: "+5511977776666" };
    expect(await processarConversa(job)).toBe(2);
    expect(await processarConversa(job)).toBe(0);
  });
});
