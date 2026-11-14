import { getRequestHeaders } from "@tanstack/react-start/server";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { auth } from "./index";

export interface Contexto {
  userId: string;
  nome: string;
  email: string;
  admin: boolean;
  tenantId: string | null;
  membroId: string | null;
  papel: "sindico" | "conselho" | "admin" | null;
}

/** Usuário da requisição e o cliente em que atua. null = não logado. */
export async function lerContexto(): Promise<Contexto | null> {
  const s = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!s) return null;
  // ponytail: usa o primeiro vínculo; seletor de cliente quando alguém atuar em vários.
  const { rows } = await db().execute<{
    tenant_id: string;
    membro_id: string;
    papel: Contexto["papel"];
  }>(sql`select tenant_id, membro_id, papel from membros_do_usuario(${s.user.id}) limit 1`);
  return {
    userId: s.user.id,
    nome: s.user.name,
    email: s.user.email,
    admin: (s.user as { role?: string }).role === "admin",
    tenantId: rows[0]?.tenant_id ?? null,
    membroId: rows[0]?.membro_id ?? null,
    papel: rows[0]?.papel ?? null,
  };
}

/** Para server functions de /app: exige login e cliente. O tenant vem da sessão, nunca do navegador. */
export async function exigirCliente(): Promise<Contexto & { tenantId: string }> {
  const c = await lerContexto();
  if (!c) throw new Error("Sessão expirada. Entre de novo.");
  if (!c.tenantId) throw new Error("Usuário sem cliente vinculado.");
  return c as Contexto & { tenantId: string };
}
