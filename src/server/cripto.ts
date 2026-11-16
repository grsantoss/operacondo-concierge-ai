/**
 * Cifra segredos de cliente guardados no banco (ex.: token da Z-API) com AES-256-GCM.
 * Chave: CREDENCIAIS_CHAVE = 32 bytes em base64 (gere com `openssl rand -base64 32`).
 * Formato: "v1.<iv>.<tag>.<dados>" (base64url). O "v1" permite trocar o esquema depois.
 * ponytail: uma chave só; rotação = nova versão "v2" com outra variável e regravação dos canais.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function chave(): Buffer {
  const b64 = process.env.CREDENCIAIS_CHAVE;
  if (!b64) throw new Error("CREDENCIAIS_CHAVE não configurada.");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("CREDENCIAIS_CHAVE deve ter 32 bytes (base64).");
  return k;
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return ["v1", iv, c.getAuthTag(), dados]
    .map((x) => (typeof x === "string" ? x : x.toString("base64url")))
    .join(".");
}

export function decifrar(cifrado: string): string {
  const [v, iv, tag, dados] = cifrado.split(".");
  if (v !== "v1" || !iv || !tag || !dados) throw new Error("Credencial em formato desconhecido.");
  const d = createDecipheriv("aes-256-gcm", chave(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(dados, "base64url")), d.final()]).toString("utf8");
}
