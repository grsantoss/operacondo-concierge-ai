/**
 * Cliente mínimo da Z-API (https://developer.z-api.io).
 * Rotas: https://api.z-api.io/instances/{instanceId}/token/{token}/<rota>, cabeçalho Client-Token
 * (token de segurança da conta; obrigatório quando ativado no painel).
 * ZAPI_URL troca a base (teste com servidor falso).
 * ponytail: caminhos das rotas conferidos na documentação, mas ainda não contra uma instância real;
 * confirmar no teste de ponta a ponta.
 */
export interface CredZapi {
  instanceId: string;
  token: string;
  clientToken?: string;
}

export class ErroZapi extends Error {}

async function chamar<T>(
  cred: CredZapi,
  metodo: "GET" | "POST" | "PUT",
  rota: string,
  corpo?: unknown,
): Promise<T> {
  const base = process.env.ZAPI_URL ?? "https://api.z-api.io";
  const url = `${base}/instances/${encodeURIComponent(cred.instanceId)}/token/${encodeURIComponent(cred.token)}/${rota}`;
  let r: Response;
  try {
    r = await fetch(url, {
      method: metodo,
      headers: {
        "Content-Type": "application/json",
        ...(cred.clientToken ? { "Client-Token": cred.clientToken } : {}),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ErroZapi("Não foi possível falar com a Z-API. Tente de novo em instantes.");
  }
  const json = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) {
    if (
      r.status === 401 ||
      r.status === 403 ||
      /client-token|null not allowed/i.test(json.error ?? "")
    )
      throw new ErroZapi(
        "A Z-API recusou as credenciais. Confira o Instance ID, o Token e o Client-Token.",
      );
    if (r.status === 404)
      throw new ErroZapi("Instância não encontrada na Z-API. Confira o Instance ID e o Token.");
    throw new ErroZapi(`A Z-API respondeu com erro (${r.status}).`);
  }
  return json;
}

/** connected = número pareado; smartphoneConnected = celular com internet. */
export const statusZapi = (c: CredZapi) =>
  chamar<{ connected: boolean; error?: string; smartphoneConnected?: boolean }>(c, "GET", "status");

/** QR Code para parear (vence a cada ~20 s; a Z-API recomenda pedir de novo a cada 10–20 s). */
export async function qrCodeZapi(c: CredZapi): Promise<string | null> {
  const r = await chamar<{ value?: string }>(c, "GET", "qr-code/image");
  if (!r.value) return null;
  return r.value.startsWith("data:") ? r.value : `data:image/png;base64,${r.value}`;
}

export const dispositivoZapi = (c: CredZapi) =>
  chamar<{ phone?: string; name?: string; isBusiness?: boolean }>(c, "GET", "device");

export const desconectarZapi = (c: CredZapi) => chamar<unknown>(c, "GET", "disconnect");
