/** Endereço de atendimento por e-mail do cliente (#82): onboarding e Configurações → Integrações. */
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { exigirCliente } from "@/server/auth/contexto";
import { schema as s, withTenant } from "@/server/db";
import { garantirCanalEmail } from "@/server/email-entrada/canal";

export interface CanalEmail {
  endereco: string;
  /** "conectado" depois que o primeiro e-mail chegou. */
  recebendo: boolean;
  ultimoRecebidoEm: string | null;
}

/** Cria o endereço na primeira visita. Sem `EMAIL_DOMINIO` (canal desligado), devolve null. */
export const obterCanalEmail = createServerFn({ method: "GET" }).handler(
  async (): Promise<CanalEmail | null> => {
    const { tenantId } = await exigirCliente();
    if (!process.env.EMAIL_DOMINIO?.trim()) return null;
    await garantirCanalEmail(tenantId);
    const [c] = await withTenant(tenantId, (tx) =>
      tx.select().from(s.emailCanais).where(eq(s.emailCanais.tenantId, tenantId)),
    );
    if (!c) return null;
    return {
      endereco: c.endereco,
      recebendo: c.status === "conectado",
      ultimoRecebidoEm: c.verificadoEm?.toISOString() ?? null,
    };
  },
);
