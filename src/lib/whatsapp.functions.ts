/**
 * Canal de WhatsApp do cliente (`whatsapp_canais`, um por cliente, para todos os condomínios).
 * Z-API primeiro; o token fica cifrado no banco e nunca volta para o navegador.
 */
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { formatarTelefone, paraE164 } from "@/lib/telefone";
import { exigirCliente } from "@/server/auth/contexto";
import { cifrar, decifrar } from "@/server/cripto";
import { schema as s, withTenant, type Tx } from "@/server/db";
import {
  desconectarZapi,
  dispositivoZapi,
  ErroZapi,
  qrCodeZapi,
  statusZapi,
  type CredZapi,
} from "@/server/whatsapp/zapi";

export interface CanalWhatsApp {
  provider: "zapi" | "meta";
  telefone: string;
  instanceId: string;
  temClientToken: boolean;
  status: "conectado" | "desconectado";
  verificadoEm: string | null;
  conectadoEm: string | null;
}

export interface Verificacao {
  conectado: boolean;
  /** QR Code (data URL) quando ainda não pareado. */
  qrCode: string | null;
  aviso: string | null;
}

/** Só o síndico (ou administrador do cliente) mexe no canal; o conselho só vê. */
async function exigirGestor() {
  const c = await exigirCliente();
  if (c.papel === "conselho") throw new Error("Só o síndico pode configurar o WhatsApp.");
  return c;
}

async function lerCanal(tx: Tx) {
  const [c] = await tx.select().from(s.whatsappCanais).limit(1);
  return c ?? null;
}

function credDe(c: { instanceId: string | null; credenciaisCifradas: string | null }): CredZapi {
  if (!c.instanceId || !c.credenciaisCifradas)
    throw new Error("Salve as credenciais da Z-API primeiro.");
  const { token, clientToken } = JSON.parse(decifrar(c.credenciaisCifradas)) as {
    token: string;
    clientToken?: string;
  };
  return { instanceId: c.instanceId, token, clientToken };
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export const obterCanal = createServerFn({ method: "GET" }).handler(
  async (): Promise<CanalWhatsApp | null> => {
    const { tenantId } = await exigirCliente();
    const c = await withTenant(tenantId, lerCanal);
    if (!c) return null;
    let temClientToken = false;
    if (c.credenciaisCifradas) {
      try {
        temClientToken = !!(JSON.parse(decifrar(c.credenciaisCifradas)) as { clientToken?: string })
          .clientToken;
      } catch {
        /* chave trocada ou dado inválido: a tela pede para salvar de novo */
      }
    }
    return {
      provider: c.provider,
      telefone: formatarTelefone(c.phoneE164),
      instanceId: c.instanceId ?? "",
      temClientToken,
      status: c.status,
      verificadoEm: iso(c.verificadoEm),
      conectadoEm: iso(c.conectadoEm),
    };
  },
);

export const salvarCanal = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      telefone: z.string().min(1, "Informe o número do WhatsApp."),
      instanceId: z.string().trim().min(5, "Informe o Instance ID da Z-API.").max(100),
      /** Vazio ao editar = mantém o token salvo. */
      token: z.string().trim().max(200).default(""),
      clientToken: z.string().trim().max(200).default(""),
    }),
  )
  .handler(async ({ data }) => {
    const { tenantId } = await exigirGestor();
    const phoneE164 = paraE164(data.telefone);
    if (!phoneE164) throw new Error("Número de WhatsApp inválido. Use DDD + número.");
    try {
      await withTenant(tenantId, async (tx) => {
        const atual = await lerCanal(tx);
        let anterior: { token?: string; clientToken?: string } = {};
        if (atual?.credenciaisCifradas) {
          try {
            anterior = JSON.parse(decifrar(atual.credenciaisCifradas));
          } catch {
            anterior = {};
          }
        }
        const token = data.token || anterior.token;
        if (!token) throw new Error("Informe o Token da instância.");
        const clientToken = data.clientToken || anterior.clientToken;
        const valores = {
          phoneE164,
          provider: "zapi" as const,
          instanceId: data.instanceId,
          credenciaisCifradas: cifrar(JSON.stringify({ token, clientToken })),
          // credencial nova: precisa verificar de novo
          status: "desconectado" as const,
          conectadoEm: null,
        };
        await tx
          .insert(s.whatsappCanais)
          .values({ tenantId, ...valores })
          .onConflictDoUpdate({ target: s.whatsappCanais.tenantId, set: valores });
      });
    } catch (err) {
      const e = err as { code?: string; cause?: { code?: string } };
      if ((e.cause?.code ?? e.code) === "23505")
        throw new Error("Este número de WhatsApp já está em uso por outro cliente.");
      throw err;
    }
  });

/** Pergunta à Z-API se o número está pareado; se não, devolve o QR Code para escanear. */
export const verificarCanal = createServerFn({ method: "POST" }).handler(
  async (): Promise<Verificacao> => {
    const { tenantId } = await exigirGestor();
    const canal = await withTenant(tenantId, lerCanal);
    if (!canal) throw new Error("Salve as credenciais da Z-API primeiro.");
    const cred = credDe(canal);
    let r: Verificacao = { conectado: false, qrCode: null, aviso: null };
    try {
      const st = await statusZapi(cred);
      if (st.connected) {
        r.conectado = true;
        const dev = await dispositivoZapi(cred).catch(() => null);
        const conectado = dev?.phone ? paraE164(dev.phone) : null;
        if (conectado && conectado !== canal.phoneE164)
          r.aviso = `A instância está pareada com ${formatarTelefone(conectado)}, não com ${formatarTelefone(canal.phoneE164)}. Confira o número.`;
        if (st.smartphoneConnected === false)
          r.aviso ??= "Conectado, mas o celular está sem internet.";
      } else {
        r = { ...r, qrCode: await qrCodeZapi(cred) };
      }
    } catch (err) {
      if (err instanceof ErroZapi) throw new Error(err.message);
      throw err;
    }
    await withTenant(tenantId, (tx) =>
      tx
        .update(s.whatsappCanais)
        .set({
          status: r.conectado ? "conectado" : "desconectado",
          verificadoEm: new Date(),
          ...(r.conectado && !canal.conectadoEm ? { conectadoEm: new Date() } : {}),
          ...(!r.conectado ? { conectadoEm: null } : {}),
        })
        .where(eq(s.whatsappCanais.id, canal.id)),
    );
    return r;
  },
);

export const desconectarCanal = createServerFn({ method: "POST" }).handler(async () => {
  const { tenantId } = await exigirGestor();
  const canal = await withTenant(tenantId, lerCanal);
  if (!canal) return;
  try {
    await desconectarZapi(credDe(canal));
  } catch (err) {
    if (err instanceof ErroZapi) throw new Error(err.message);
    throw err;
  }
  await withTenant(tenantId, (tx) =>
    tx
      .update(s.whatsappCanais)
      .set({ status: "desconectado", conectadoEm: null, verificadoEm: new Date() })
      .where(eq(s.whatsappCanais.id, canal.id)),
  );
});
