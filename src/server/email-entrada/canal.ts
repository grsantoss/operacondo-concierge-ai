/** Endereço de atendimento do cliente: `{nome}@EMAIL_DOMINIO`, criado uma vez (#79). */
import { eq } from "drizzle-orm";
import { dbAdmin, schema as s } from "@/server/db";

export const slug = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/, "") || "cliente";

/** Devolve o endereço do cliente, criando na 1ª vez (com sufixo se o nome já existir). */
export async function garantirCanalEmail(tenantId: string): Promise<string> {
  const dominio = process.env.EMAIL_DOMINIO?.trim().toLowerCase();
  if (!dominio) throw new Error("EMAIL_DOMINIO não definido (veja .env.example).");
  const db = dbAdmin();
  const doCliente = async () =>
    (await db.select().from(s.emailCanais).where(eq(s.emailCanais.tenantId, tenantId)))[0];
  const atual = await doCliente();
  if (atual) return atual.endereco;
  const [t] = await db.select().from(s.tenants).where(eq(s.tenants.id, tenantId));
  if (!t) throw new Error("Cliente não encontrado.");
  const base = slug(t.nomeFantasia);
  for (let n = 1; n < 50; n++) {
    const endereco = `${n === 1 ? base : `${base}-${n}`}@${dominio}`;
    const [novo] = await db
      .insert(s.emailCanais)
      .values({ tenantId, endereco })
      .onConflictDoNothing()
      .returning();
    if (novo) return novo.endereco;
    // Conflito: outra chamada criou o canal deste cliente, ou o endereço é de outro cliente.
    const criado = await doCliente();
    if (criado) return criado.endereco;
  }
  throw new Error("Não foi possível gerar o endereço de atendimento.");
}
