/**
 * E-mail pela Amazon SES (decisão #43). Avisos da plataforma (`enviarEmail`, texto puro) e a
 * resposta ao morador na mesma thread (`enviarRespostaEmail`, #81). Avisos ligados por
 * `SES_REMETENTE`; sem ele, o envio é pulado com um log (dev e testes). Credenciais:
 * `SES_ACCESS_KEY`/`SES_SECRET_KEY` ou a cadeia padrão da AWS (ex.: papel IAM da máquina).
 * `SES_URL` troca o endereço da API (servidor falso nos testes, como o `ZAPI_URL`).
 */
import { randomUUID } from "node:crypto";
import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";

let cliente: SESv2Client | undefined;

function ses() {
  cliente ??= new SESv2Client({
    region: process.env.SES_REGION ?? "sa-east-1",
    ...(process.env.SES_URL ? { endpoint: process.env.SES_URL } : {}),
    credentials: process.env.SES_ACCESS_KEY
      ? {
          accessKeyId: process.env.SES_ACCESS_KEY,
          secretAccessKey: process.env.SES_SECRET_KEY ?? "",
        }
      : undefined,
  });
  return cliente;
}

export const emailConfigurado = () => Boolean(process.env.SES_REMETENTE);

export interface Email {
  para: string[];
  assunto: string;
  texto: string;
}

/** Envia em texto puro. Devolve false se o e-mail não está configurado ou não há destinatário. */
export async function enviarEmail({ para, assunto, texto }: Email): Promise<boolean> {
  const destino = [...new Set(para.filter(Boolean))];
  if (!destino.length) return false;
  if (!emailConfigurado()) {
    console.warn(`[email] SES_REMETENTE vazio: "${assunto}" não foi enviado`);
    return false;
  }
  await ses().send(
    new SendEmailCommand({
      FromEmailAddress: process.env.SES_REMETENTE,
      Destination: { ToAddresses: destino },
      Content: {
        Simple: {
          Subject: { Data: assunto, Charset: "UTF-8" },
          Body: { Text: { Data: texto, Charset: "UTF-8" } },
        },
      },
    }),
  );
  return true;
}

export interface RespostaEmail {
  /** Endereço de atendimento do cliente (domínio verificado na SES). */
  de: string;
  nome: string;
  para: string;
  assunto: string;
  texto: string;
  /** Message-ID do e-mail respondido e os anteriores da conversa (thread). */
  inReplyTo: string | null;
  references: string[];
}

const ENDERECO = /^[^\s<>@,;"]+@[^\s<>@,;"]+$/;
const b64 = (t: string) => Buffer.from(t, "utf8").toString("base64");
/** Cabeçalho com acento: "encoded-word" (RFC 2047). Também impede quebra de linha no cabeçalho. */
const palavra = (t: string) => `=?UTF-8?B?${b64(t.replace(/[\r\n]+/g, " "))}?=`;
const corpo = (t: string) => b64(t).replace(/.{1,76}/g, "$&\r\n");
const idValido = (id: string) => /^<[^\s<>]+>$/.test(id);
const html = (t: string) =>
  t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");

/** Monta o e-mail (texto + HTML simples) com os cabeçalhos de thread. */
export function montarResposta(r: RespostaEmail, messageId: string): string {
  if (!ENDERECO.test(r.de) || !ENDERECO.test(r.para))
    throw new Error("Endereço de e-mail inválido.");
  const refs = r.references.filter(idValido).slice(-10);
  const limite = `concierge-${randomUUID()}`;
  return [
    `From: ${palavra(r.nome)} <${r.de}>`,
    `Reply-To: ${r.de}`,
    `To: ${r.para}`,
    `Subject: ${palavra(r.assunto)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    ...(r.inReplyTo && idValido(r.inReplyTo) ? [`In-Reply-To: ${r.inReplyTo}`] : []),
    ...(refs.length ? [`References: ${refs.join(" ")}`] : []),
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${limite}"`,
    "",
    `--${limite}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    corpo(r.texto),
    `--${limite}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    corpo(`<!doctype html><html><body>${html(r.texto)}</body></html>`),
    `--${limite}--`,
    "",
  ].join("\r\n");
}

/** Assunto da resposta: "Re: <assunto>" (sem repetir o "Re:"). */
export const assuntoResposta = (assunto: string | null) =>
  !assunto?.trim()
    ? "Resposta da administração do condomínio"
    : /^(re|res|resp)\s*:/i.test(assunto.trim())
      ? assunto.trim()
      : `Re: ${assunto.trim()}`;

/** Envia pela SES e devolve o Message-ID gravado na mensagem e o id da SES. */
export async function enviarRespostaEmail(
  r: RespostaEmail,
): Promise<{ messageId: string; sesId: string | null }> {
  const messageId = `<${randomUUID()}@${r.de.split("@")[1]}>`;
  const bruto = montarResposta(r, messageId);
  const res = await ses().send(
    new SendEmailCommand({ Content: { Raw: { Data: new TextEncoder().encode(bruto) } } }),
  );
  return { messageId, sesId: res.MessageId ?? null };
}
