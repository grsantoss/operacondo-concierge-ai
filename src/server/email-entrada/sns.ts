/**
 * Verificação das mensagens do Amazon SNS (o aviso da SES chega por ele). A assinatura cobre os
 * campos da mensagem em ordem fixa; o certificado só é aceito de `sns.<região>.amazonaws.com`.
 * https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
 */
import { createVerify } from "node:crypto";

export interface MensagemSns {
  Type: "Notification" | "SubscriptionConfirmation" | "UnsubscribeConfirmation" | string;
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  Subject?: string;
  Token?: string;
  SubscribeURL?: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
}

/** URL da própria AWS (certificado e confirmação de inscrição). */
export function urlDoSns(url: string | undefined): boolean {
  try {
    const u = new URL(url ?? "");
    return u.protocol === "https:" && /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/.test(u.hostname);
  } catch {
    return false;
  }
}

/** Texto assinado: "Campo\nValor\n" na ordem da documentação. */
export function textoAssinado(m: MensagemSns): string {
  const campos =
    m.Type === "Notification"
      ? ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"]
      : ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"];
  return campos
    .filter((c) => m[c as keyof MensagemSns] !== undefined)
    .map((c) => `${c}\n${m[c as keyof MensagemSns]}\n`)
    .join("");
}

const certs = new Map<string, Promise<string>>();

export async function buscarCertificado(url: string): Promise<string> {
  let c = certs.get(url);
  if (!c) {
    c = fetch(url, { signal: AbortSignal.timeout(10_000) }).then((r) => {
      if (!r.ok) throw new Error(`Certificado do SNS respondeu ${r.status}.`);
      return r.text();
    });
    c.catch(() => certs.delete(url));
    certs.set(url, c);
  }
  return c;
}

/** Assinatura válida e certificado da AWS. `buscar` troca o download nos testes. */
export async function assinaturaValida(
  m: MensagemSns,
  buscar: (url: string) => Promise<string> = buscarCertificado,
): Promise<boolean> {
  if (!m?.Signature || !urlDoSns(m.SigningCertURL)) return false;
  const algoritmo =
    m.SignatureVersion === "2" ? "RSA-SHA256" : m.SignatureVersion === "1" ? "RSA-SHA1" : null;
  if (!algoritmo) return false;
  try {
    const cert = await buscar(m.SigningCertURL);
    return createVerify(algoritmo)
      .update(textoAssinado(m), "utf8")
      .verify(cert, m.Signature, "base64");
  } catch {
    return false;
  }
}
