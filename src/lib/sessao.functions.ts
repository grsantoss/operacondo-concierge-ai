import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { sql } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

export interface Sessao {
  userId: string;
  nome: string;
  email: string;
  /** Admin Master da plataforma (/admin). */
  admin: boolean;
  /** Cliente em que o usuário atua; null = sem vínculo (só faz sentido para o Admin Master). */
  tenantId: string | null;
  papel: "sindico" | "conselho" | "admin" | null;
}

/** Sessão atual + cliente do usuário. null = não logado. */
export const getSessao = createServerFn({ method: "GET" }).handler(
  async (): Promise<Sessao | null> => {
    const s = await auth.api.getSession({ headers: getRequestHeaders() });
    if (!s) return null;
    // ponytail: usa o primeiro vínculo; seletor de cliente quando alguém atuar em vários.
    const { rows } = await db().execute<{ tenant_id: string; papel: Sessao["papel"] }>(
      sql`select tenant_id, papel from membros_do_usuario(${s.user.id}) limit 1`,
    );
    return {
      userId: s.user.id,
      nome: s.user.name,
      email: s.user.email,
      admin: (s.user as { role?: string }).role === "admin",
      tenantId: rows[0]?.tenant_id ?? null,
      papel: rows[0]?.papel ?? null,
    };
  },
);
