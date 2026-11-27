/** Ordem da caixa de /app/agente (#100). Precisa do banco local. */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { caixaDeConversas } from "../src/server/conversas";
import { dbAdmin, schema as s, withTenant } from "../src/server/db";

const admin = dbAdmin();
let tenantId: string;

beforeAll(async () => {
  const [t] = await admin
    .insert(s.tenants)
    .values({ razaoSocial: "Teste Caixa", nomeFantasia: "Teste Caixa" })
    .returning();
  tenantId = t!.id;
  const [condo] = await admin
    .insert(s.condominios)
    .values({ tenantId, nome: "Edifício Caixa", tipo: "vertical" })
    .returning();
  const [canal] = await admin
    .insert(s.whatsappCanais)
    .values({ tenantId, phoneE164: "+5511900008888", provider: "zapi" })
    .returning();
  const min = (n: number) => new Date(Date.now() - n * 60_000);
  const conversa = (endereco: string, extra: Partial<typeof s.conversas.$inferInsert>) => ({
    tenantId,
    canalId: canal!.id,
    condominioId: condo!.id,
    endereco,
    ...extra,
  });
  const cs = await admin
    .insert(s.conversas)
    .values([
      conversa("+5511911110001", { ultimaMsgEm: min(1) }), // normal, agora
      conversa("+5511911110002", { prioridade: "critica", ultimaMsgEm: min(60) }),
      conversa("+5511911110003", {
        prioridade: "critica",
        estado: "resolvida",
        ultimaMsgEm: min(0),
      }),
      conversa("+5511911110004", { ultimaMsgEm: min(120) }), // alta pela demanda aberta
      conversa("+5511911110005", { ultimaMsgEm: min(30) }), // demanda alta já resolvida
      conversa("+5511911110006", { prioridade: "alta", ultimaMsgEm: min(10) }),
    ])
    .returning();
  const demanda = (conversaId: string, codigo: string, coluna: "novas" | "resolvidas") => ({
    tenantId,
    condominioId: condo!.id,
    conversaId,
    codigo,
    titulo: "Teste",
    categoria: "manutencao" as const,
    prioridade: "alta" as const,
    coluna,
  });
  await admin
    .insert(s.demandas)
    .values([demanda(cs[3]!.id, "CX-1", "novas"), demanda(cs[4]!.id, "CX-2", "resolvidas")]);
});

afterAll(async () => {
  await admin.delete(s.tenants).where(eq(s.tenants.id, tenantId));
});

test("Crítica → Alta → Normal, mais recente primeiro em cada nível, resolvidas no fim", async () => {
  const linhas = await withTenant(tenantId, (tx) => caixaDeConversas(tx));
  expect(linhas.map((l) => l.conversa.endereco.slice(-1))).toEqual(["2", "6", "4", "1", "5", "3"]);
});
