/**
 * Limpeza do e-mail recebido (#79): o agente recebe só a mensagem nova, sem histórico citado,
 * assinatura e HTML; e respostas automáticas, listas e loops não viram conversa.
 * ponytail: heurística por padrões comuns (Gmail, Outlook, Apple Mail, em pt e en); trocar por
 * biblioteca de "reply parsing" se aparecerem clientes de e-mail que escapam.
 */
import type { Email } from "postal-mime";

const ENTIDADES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/** HTML → texto simples (só quando o e-mail não traz a parte em texto). */
export function htmlParaTexto(html: string): string {
  return html
    .replace(/<(head|style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#")
        return String.fromCodePoint(
          e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)),
        );
      return ENTIDADES[e.toLowerCase()] ?? m;
    });
}

/** Onde começa o histórico citado (o que vem depois é cortado). */
const CORTES = [
  // Gmail/Apple: "Em qua., 18 de nov. de 2026 às 10:00, Ana <ana@x.com> escreveu:" (pode quebrar a linha)
  /^[ \t]*(Em|On)\s[^\n]*(\n[^\n]*)?\s(escreveu|wrote)\s*:\s*$/im,
  /^[ \t]*-{2,}\s*(Mensagem original|Original Message)\s*-{2,}/im,
  // Outlook: "De: … / Enviado: …"
  /^[ \t]*(De|From)\s*:[^\n]*\n[ \t]*(Enviad[oa]|Sent|Data|Date)\s*:/im,
  /^[ \t]*_{20,}\s*$/m,
  // Assinatura: "-- " sozinho na linha.
  /^-- ?$/m,
];

export function limparTexto(texto: string): string {
  let t = texto.replace(/\r\n?/g, "\n");
  for (const re of CORTES) {
    const i = t.search(re);
    if (i >= 0) t = t.slice(0, i);
  }
  return t
    .split("\n")
    .filter((l) => !/^\s*>/.test(l))
    .filter((l) => !/^\s*(Enviado do meu|Enviado de meu|Sent from my)\b/i.test(l))
    .join("\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function textoDoEmail(email: Pick<Email, "text" | "html">): string {
  return limparTexto(email.text?.trim() ? email.text : htmlParaTexto(email.html ?? ""));
}

const REMETENTE_AUTOMATICO =
  /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|nao-?responda|naoresponda)@/i;
const ASSUNTO_AUTOMATICO =
  /^\s*(resposta autom[aá]tica|automatic reply|auto(matic)?[ -]?reply|autoreply|fora do escrit[oó]rio|out of (the )?office|ausente|aus[eê]ncia)\b/i;

/**
 * Motivo para não abrir conversa, ou null. `proprios` = endereços e domínios do Concierge
 * (o e-mail que nós mesmos enviamos não pode voltar como pergunta).
 */
export function motivoIgnorar(
  email: Pick<Email, "headers" | "subject">,
  remetente: string,
  proprios: string[],
): string | null {
  const h = (k: string) =>
    email.headers
      .find((x) => x.key === k)
      ?.value.trim()
      .toLowerCase();
  const auto = h("auto-submitted");
  if (auto && auto !== "no") return "resposta automática";
  if (h("x-autoreply") || h("x-autorespond")) return "resposta automática";
  if (/^(bulk|list|junk|auto_reply)$/.test(h("precedence") ?? "")) return "lista ou envio em massa";
  if (h("list-id") || h("list-unsubscribe")) return "lista de e-mails";
  if (REMETENTE_AUTOMATICO.test(remetente)) return "remetente automático";
  const dominio = remetente.split("@")[1] ?? "";
  if (proprios.some((p) => p && (p === remetente || p === dominio)))
    return "enviado pelo próprio Concierge";
  if (ASSUNTO_AUTOMATICO.test(email.subject ?? "")) return "fora do escritório";
  return null;
}
