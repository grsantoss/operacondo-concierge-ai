/** Criação de cliente com o acesso do síndico (Admin Master e autoatendimento). Só oc_admin. */
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";
import { dbAdmin, schema as s } from "@/server/db";

type Tx = Parameters<Parameters<ReturnType<typeof dbAdmin>["transaction"]>[0]>[0];

/** Erro de duplicidade em mensagem para a tela; os demais seguem. */
export function erroUnico(err: unknown): never {
  const e = err as {
    code?: string;
    constraint?: string;
    cause?: { code?: string; constraint?: string };
  };
  const code = e.code ?? e.cause?.code;
  const constraint = e.constraint ?? e.cause?.constraint ?? "";
  if (code === "23505" && constraint.includes("cnpj"))
    throw new Error("Já existe um cliente com este CNPJ.");
  if (code === "23505" && constraint.includes("email"))
    throw new Error("Já existe um usuário com este e-mail.");
  throw err;
}

/** Cliente + usuário com senha + vínculo de síndico, na transação dada. Devolve o id do cliente. */
export async function inserirCliente(
  tx: Tx,
  cliente: typeof s.tenants.$inferInsert,
  acesso: { nome: string; email: string; senha: string },
): Promise<string> {
  const hash = await hashPassword(acesso.senha);
  const [t] = await tx.insert(s.tenants).values(cliente).returning({ id: s.tenants.id });
  const userId = randomUUID();
  await tx
    .insert(s.user)
    .values({ id: userId, name: acesso.nome, email: acesso.email, emailVerified: true });
  await tx.insert(s.account).values({
    id: randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: hash,
  });
  await tx.insert(s.membros).values({ tenantId: t!.id, userId, papel: "sindico" });
  return t!.id;
}
