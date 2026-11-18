import { createServerFn } from "@tanstack/react-start";
import { lerContexto } from "@/server/auth/contexto";
import { schema as s, withTenant } from "@/server/db";

export interface Sessao {
  userId: string;
  nome: string;
  email: string;
  /** Admin Master da plataforma (/admin). */
  admin: boolean;
  /** Cliente em que o usuário atua; null = sem vínculo (só faz sentido para o Admin Master). */
  tenantId: string | null;
  papel: "sindico" | "conselho" | "admin" | null;
  /** Cliente do autoatendimento que ainda não passou pelo Checkout (o /app manda para /assinar). */
  assinaturaPendente: boolean;
}

/** Sessão atual + cliente do usuário. null = não logado. */
export const getSessao = createServerFn({ method: "GET" }).handler(
  async (): Promise<Sessao | null> => {
    const c = await lerContexto();
    if (!c) return null;
    const assinaturas = c.tenantId
      ? await withTenant(c.tenantId, (tx) => tx.$count(s.assinaturas))
      : 0;
    return {
      userId: c.userId,
      nome: c.nome,
      email: c.email,
      admin: c.admin,
      tenantId: c.tenantId,
      papel: c.papel,
      assinaturaPendente: Boolean(c.tenantId) && assinaturas === 0,
    };
  },
);
