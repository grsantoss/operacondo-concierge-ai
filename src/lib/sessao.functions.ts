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
  /** Inadimplência (#35): fase e datas do job diário; null = em dia. */
  cobranca: {
    suspensao: "nenhuma" | "parcial" | "integral";
    inadimplenteDesde: string | null;
    exclusaoPrevistaEm: string | null;
  } | null;
}

/** Sessão atual + cliente do usuário. null = não logado. */
export const getSessao = createServerFn({ method: "GET" }).handler(
  async (): Promise<Sessao | null> => {
    const c = await lerContexto();
    if (!c) return null;
    const [assinaturas, t] = c.tenantId
      ? await withTenant(c.tenantId, async (tx) => [
          await tx.$count(s.assinaturas),
          (
            await tx
              .select({
                suspensao: s.tenants.suspensao,
                inadimplenteDesde: s.tenants.inadimplenteDesde,
                exclusaoPrevistaEm: s.tenants.exclusaoPrevistaEm,
              })
              .from(s.tenants)
          )[0],
        ] as const)
      : [0, undefined];
    return {
      userId: c.userId,
      nome: c.nome,
      email: c.email,
      admin: c.admin,
      tenantId: c.tenantId,
      papel: c.papel,
      assinaturaPendente: Boolean(c.tenantId) && assinaturas === 0,
      cobranca: t?.inadimplenteDesde || (t && t.suspensao !== "nenhuma") ? t : null,
    };
  },
);
