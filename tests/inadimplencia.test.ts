/** Job diário de inadimplência: fases, avisos e exclusão no D+30. Banco local (e S3 do dev). */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import {
  aplicarInadimplencia,
  avisoDevido,
  fase,
  textoAviso,
} from "../src/server/billing/inadimplencia";
import { dbAdmin, schema as s } from "../src/server/db";

const admin = dbAdmin();
let tenantId: string;
const userId = `usr_inad_${Date.now()}`;
const HOJE = "2026-11-18";
const menos = (n: number) =>
  new Date(Date.parse(`${HOJE}T00:00:00Z`) - n * 864e5).toISOString().slice(0, 10);
// Sem S3 no CI: registra o prefixo que seria apagado.
const apagadas: string[] = [];
const apagar = async (prefixo: string) => {
  apagadas.push(prefixo);
};
const cliente = async () =>
  (await admin.select().from(s.tenants).where(eq(s.tenants.id, tenantId)))[0]!;

beforeAll(async () => {
  const [t] = await admin
    .insert(s.tenants)
    .values({
      razaoSocial: "Inadimplente Ltda",
      nomeFantasia: "Inadimplente",
      inadimplenteDesde: menos(8),
      email: "a@x.local",
    })
    .returning();
  tenantId = t!.id;
  const [a] = await admin
    .insert(s.assinaturas)
    .values({ tenantId, planoId: "essencial", status: "past_due", formaCobranca: "boleto" })
    .returning();
  await admin.insert(s.faturas).values({
    tenantId,
    assinaturaId: a!.id,
    status: "open",
    valorTotal: 197,
    vencimento: menos(8),
  });
  await admin.insert(s.user).values({ id: userId, name: "Síndico", email: `${userId}@x.local` });
  await admin.insert(s.membros).values({ tenantId, userId, papel: "sindico" });
  const [c] = await admin
    .insert(s.condominios)
    .values({ tenantId, nome: "Edifício Inad", tipo: "vertical" })
    .returning();
  await admin
    .insert(s.moradores)
    .values({ tenantId, condominioId: c!.id, nome: "Ana", cadastro: "aprovado" });
});

afterAll(async () => {
  await admin.delete(s.tenants).where(eq(s.tenants.id, tenantId));
  await admin.delete(s.user).where(eq(s.user.id, userId));
});

test("fases e avisos por dia de atraso", () => {
  expect([1, 6, 7, 9, 10, 29, 30].map(fase)).toEqual([
    "nenhuma",
    "nenhuma",
    "parcial",
    "parcial",
    "integral",
    "integral",
    "exclusao",
  ]);
  expect(avisoDevido(1, 0)).toBe(1);
  expect(avisoDevido(3, 1)).toBeNull();
  // Job parado uns dias: manda só o aviso mais recente.
  expect(avisoDevido(12, 1)).toBe(10);
  expect(avisoDevido(27, 20)).toBe(27);
  const t = textoAviso(20, {
    nome: "Aurora",
    desde: "2026-11-01",
    parcial: "2026-11-08",
    integral: "2026-11-11",
    exclusao: "2026-12-01",
    url: "https://app/x",
  });
  expect(t.assunto).toContain("01/12/2026");
  expect(t.texto).toContain("https://app/x");
});

test("D+8: suspensão parcial, aviso do D+7 e data da exclusão", async () => {
  await aplicarInadimplencia(HOJE, undefined, apagar);
  expect(await cliente()).toMatchObject({
    suspensao: "parcial",
    status: "inadimplente",
    avisoInadimplencia: 7,
    inadimplenteDesde: menos(8),
    exclusaoPrevistaEm: menos(8 - 30),
  });
});

test("D+10: congelado (status suspenso)", async () => {
  await admin
    .update(s.tenants)
    .set({ inadimplenteDesde: menos(10) })
    .where(eq(s.tenants.id, tenantId));
  await aplicarInadimplencia(HOJE, undefined, apagar);
  expect(await cliente()).toMatchObject({
    suspensao: "integral",
    status: "suspenso",
    avisoInadimplencia: 10,
  });
});

test("D+30: apaga os dados e o login, mantém faturas e dados fiscais", async () => {
  await admin
    .update(s.tenants)
    .set({ inadimplenteDesde: menos(30) })
    .where(eq(s.tenants.id, tenantId));
  await aplicarInadimplencia(HOJE, undefined, apagar);
  const t = await cliente();
  expect(t).toMatchObject({ status: "excluido", email: null, razaoSocial: "Inadimplente Ltda" });
  expect(t.excluidoEm).not.toBeNull();
  expect(apagadas).toEqual([`${tenantId}/`]);
  const conta = (tabela: Parameters<typeof admin.$count>[0]) =>
    admin.$count(tabela, eq((tabela as typeof s.moradores).tenantId, tenantId));
  expect(await conta(s.moradores)).toBe(0);
  expect(await conta(s.condominios)).toBe(0);
  expect(await conta(s.membros)).toBe(0);
  expect(await conta(s.faturas)).toBe(1);
  expect(await admin.$count(s.user, eq(s.user.id, userId))).toBe(0);
  // Excluído não volta a ser processado.
  await aplicarInadimplencia(HOJE, undefined, apagar);
  expect((await cliente()).status).toBe("excluido");
});
