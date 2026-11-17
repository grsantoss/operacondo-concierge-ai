/** Aprovação do cadastro feito pelo WhatsApp (#28). Banco local. */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { decidirCadastroTx as decidir } from "../src/server/moradores";
import { dbAdmin, schema as s, withTenant } from "../src/server/db";

const admin = dbAdmin();
let tenantId: string, condo: string, unidade: string;

async function pendente(nome: string, unidadeId: string | null = null) {
  const [m] = await admin
    .insert(s.moradores)
    .values({ tenantId, condominioId: condo, nome, unidadeId, unidadeInformada: "bloco A 101" })
    .returning();
  return m!.id;
}
const cadastroDe = async (id: string) =>
  (await admin.select().from(s.moradores).where(eq(s.moradores.id, id)))[0]!;
const rodar = (data: Parameters<typeof decidir>[2]) =>
  withTenant(tenantId, (tx) => decidir(tx, tenantId, data));

beforeAll(async () => {
  const [t] = await admin
    .insert(s.tenants)
    .values({ razaoSocial: "Teste Cadastro", nomeFantasia: "Teste Cadastro" })
    .returning();
  tenantId = t!.id;
  const [c] = await admin
    .insert(s.condominios)
    .values({ tenantId, nome: "Edifício Lua", tipo: "vertical" })
    .returning();
  condo = c!.id;
  const [u] = await admin
    .insert(s.unidades)
    .values({ tenantId, condominioId: condo, bloco: "A", andar: 1, apto: "101", vagas: 2 })
    .returning();
  unidade = u!.id;
});

afterAll(async () => {
  await admin.delete(s.tenants).where(eq(s.tenants.id, tenantId));
});

test("pendente já ligado à unidade: aprova sem informar endereço", async () => {
  const id = await pendente("Ana", unidade);
  await rodar({ id, decisao: "aprovar" });
  expect((await cadastroDe(id)).cadastro).toBe("aprovado");
});

test("sem unidade: exige endereço; com ele, liga à unidade existente sem mexer nas vagas", async () => {
  const id = await pendente("Beto");
  await expect(rodar({ id, decisao: "aprovar" })).rejects.toThrow("Informe a unidade");
  expect((await cadastroDe(id)).cadastro).toBe("pendente");

  await rodar({
    id,
    decisao: "aprovar",
    endereco: { tipo: "vertical", bloco: "A", andar: 1, apto: "101" },
  });
  const m = await cadastroDe(id);
  expect(m.cadastro).toBe("aprovado");
  expect(m.unidadeId).toBe(unidade);
  const [u] = await admin.select().from(s.unidades).where(eq(s.unidades.id, unidade));
  expect(u!.vagas).toBe(2);
});

test("recusar mantém o morador como recusado; não decide duas vezes", async () => {
  const id = await pendente("Caio");
  await rodar({ id, decisao: "recusar" });
  expect((await cadastroDe(id)).cadastro).toBe("recusado");
  await expect(rodar({ id, decisao: "aprovar" })).rejects.toThrow("já decidido");
});

test("outro cliente não decide (RLS)", async () => {
  const id = await pendente("Duda");
  const [outro] = await admin
    .insert(s.tenants)
    .values({ razaoSocial: "Outro", nomeFantasia: "Outro" })
    .returning();
  try {
    await expect(
      withTenant(outro!.id, (tx) => decidir(tx, outro!.id, { id, decisao: "aprovar" })),
    ).rejects.toThrow("não encontrado");
  } finally {
    await admin.delete(s.tenants).where(eq(s.tenants.id, outro!.id));
  }
});
