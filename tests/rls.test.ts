/**
 * Isolamento entre clientes. Precisa do banco com as migrations aplicadas (DATABASE_URL = oc_app,
 * DATABASE_URL_ADMIN = oc_admin). Cria dois clientes de teste e apaga no fim.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { dbAdmin, db, schema as s, withTenant } from "../src/server/db";

const admin = dbAdmin();
let A: { tenant: string; condo: string };
let B: { tenant: string; condo: string };

async function criarCliente(nome: string) {
  const [t] = await admin
    .insert(s.tenants)
    .values({ razaoSocial: nome, nomeFantasia: nome })
    .returning();
  const [c] = await admin
    .insert(s.condominios)
    .values({ tenantId: t.id, nome: `Condomínio ${nome}`, tipo: "vertical" })
    .returning();
  return { tenant: t.id, condo: c.id };
}

/** Erro do Postgres, olhando também a causa (o Drizzle embrulha o erro do driver). */
async function erroPg(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const err = e as { message?: string; cause?: { message?: string } };
    return `${err.message ?? ""} ${err.cause?.message ?? ""}`;
  }
  return "";
}

beforeAll(async () => {
  A = await criarCliente("Teste RLS A");
  B = await criarCliente("Teste RLS B");
  await admin
    .insert(s.user)
    .values({ id: "usr_teste_rls", name: "Teste", email: "rls@teste.local" });
  await admin
    .insert(s.membros)
    .values({ tenantId: A.tenant, userId: "usr_teste_rls", papel: "sindico" });
});

afterAll(async () => {
  await admin.delete(s.tenants).where(sql`${s.tenants.id} in (${A.tenant}, ${B.tenant})`);
  await admin.delete(s.user).where(eq(s.user.id, "usr_teste_rls"));
});

describe("RLS", () => {
  test("sem cliente na transação, a aplicação não vê nada", async () => {
    expect(await db().select().from(s.condominios)).toHaveLength(0);
    expect(await db().select().from(s.tenants)).toHaveLength(0);
  });

  test("dentro de withTenant, vê só o próprio cliente", async () => {
    const condos = await withTenant(A.tenant, (tx) => tx.select().from(s.condominios));
    expect(condos.map((c) => c.id)).toEqual([A.condo]);
    const tenants = await withTenant(A.tenant, (tx) => tx.select().from(s.tenants));
    expect(tenants.map((t) => t.id)).toEqual([A.tenant]);
  });

  test("não grava linha em nome de outro cliente", async () => {
    const msg = await erroPg(
      withTenant(A.tenant, (tx) =>
        tx.insert(s.condominios).values({ tenantId: B.tenant, nome: "invasão", tipo: "vertical" }),
      ),
    );
    expect(msg).toContain("row-level security");
  });

  test("não altera nem apaga dados de outro cliente", async () => {
    const alteradas = await withTenant(A.tenant, (tx) =>
      tx
        .update(s.condominios)
        .set({ nome: "alterado" })
        .where(eq(s.condominios.id, B.condo))
        .returning(),
    );
    expect(alteradas).toHaveLength(0);
    const apagadas = await withTenant(A.tenant, (tx) =>
      tx.delete(s.condominios).where(eq(s.condominios.id, B.condo)).returning(),
    );
    expect(apagadas).toHaveLength(0);
  });

  test("não aponta para o condomínio de outro cliente (FK com tenant_id)", async () => {
    const msg = await erroPg(
      withTenant(A.tenant, (tx) =>
        tx.insert(s.unidades).values({ tenantId: A.tenant, condominioId: B.condo, apto: "101" }),
      ),
    );
    expect(msg).toContain("foreign key");
  });

  test("espelho do Stripe é só leitura para a aplicação", async () => {
    const msg = await erroPg(
      withTenant(A.tenant, (tx) =>
        tx.insert(s.faturas).values({ tenantId: A.tenant, status: "paid", valorTotal: 1 }),
      ),
    );
    expect(msg).toContain("permission denied");
    expect(await erroPg(db().select().from(s.stripeEventos))).toContain("permission denied");
  });

  test("uso_mensal respeita a RLS", async () => {
    const linhas = await withTenant(A.tenant, (tx) =>
      tx.execute(sql`select tenant_id from uso_mensal`),
    );
    expect(linhas.rows).toEqual([{ tenant_id: A.tenant }]);
  });

  test("membros_do_usuario devolve só os vínculos do próprio usuário", async () => {
    const { rows } = await db().execute(
      sql`select tenant_id, papel from membros_do_usuario('usr_teste_rls')`,
    );
    expect(rows).toEqual([{ tenant_id: A.tenant, papel: "sindico" }]);
    const outro = await db().execute(sql`select * from membros_do_usuario('nao_existe')`);
    expect(outro.rows).toHaveLength(0);
  });

  test("withTenant recusa tenant_id que não é uuid", async () => {
    expect(withTenant("1' or '1'='1", async () => 1)).rejects.toThrow("tenant_id inválido");
  });

  test("toda tabela com tenant_id acessível pela aplicação tem RLS ligada", async () => {
    const { rows } = await admin.execute<{ tabela: string }>(sql`
      select c.relname as tabela
      from pg_class c
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped
      where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
        and has_table_privilege('oc_app', c.oid, 'select')
        and not c.relrowsecurity`);
    expect(rows).toEqual([]);
  });
});

describe("restrições", () => {
  test("telefone fora do padrão E.164 é recusado", async () => {
    const msg = await erroPg(
      admin
        .insert(s.whatsappCanais)
        .values({ tenantId: A.tenant, phoneE164: "(11) 99999-0000", provider: "zapi" }),
    );
    expect(msg).toContain("phone_e164_e164");
  });

  test("conversa aponta só para o canal dela, com o endereço no formato do canal", async () => {
    const [w] = await admin
      .insert(s.whatsappCanais)
      .values({ tenantId: A.tenant, phoneE164: "+5511900000078", provider: "zapi" })
      .returning();
    const [e] = await admin
      .insert(s.emailCanais)
      .values({ tenantId: A.tenant, endereco: "teste-a@atendimento.operacondo.local" })
      .returning();
    const conversa = (v: Partial<typeof s.conversas.$inferInsert>) =>
      erroPg(admin.insert(s.conversas).values({ tenantId: A.tenant, endereco: "", ...v }));
    // Válidas: WhatsApp com telefone, e-mail com endereço minúsculo.
    expect(await conversa({ canalId: w!.id, endereco: "+5511911110000" })).toBe("");
    expect(
      await conversa({ canal: "email", emailCanalId: e!.id, endereco: "ana@exemplo.com" }),
    ).toBe("");
    // Inválidas: e-mail no WhatsApp, maiúsculas, canal trocado ou os dois canais.
    for (const v of [
      { canalId: w!.id, endereco: "ana@exemplo.com" },
      { canal: "email" as const, emailCanalId: e!.id, endereco: "Ana@Exemplo.com" },
      { canal: "email" as const, canalId: w!.id, endereco: "ana@exemplo.com" },
      { canalId: w!.id, emailCanalId: e!.id, endereco: "+5511911110000" },
    ])
      expect(await conversa(v)).toContain("conversas_canal");
    // O canal de e-mail de B não é visível para A.
    expect(
      await withTenant(B.tenant, (tx) => tx.select().from(s.emailCanais)),
    ).toHaveLength(0);
    await admin.delete(s.conversas).where(eq(s.conversas.tenantId, A.tenant));
  });
});
