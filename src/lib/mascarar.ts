/**
 * LGPD: tira CPF e telefone de textos antes de qualquer envio externo (Claude; depois Langfuse e
 * Sentry). Determinístico, para não quebrar o cache do prompt.
 */

/** Dígitos verificadores do CPF (evita mascarar qualquer sequência de 11 dígitos como CPF). */
function cpfValido(d: string): boolean {
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    return ((soma * 10) % 11) % 10;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

const CPF_FORMATADO = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
const ONZE_DIGITOS = /\b\d{11}\b/g;
// +55 opcional, DDD opcional (com ou sem parênteses), 4–5 dígitos, separador opcional, 4 dígitos.
// Exige DDD ou separador, para não pegar valores e códigos soltos ("12345678").
const TELEFONE =
  /(?:\+?55[\s.-]?)?(?:\(\d{2}\)\s?|\b\d{2}[\s.-]?)?\b9?\d{4}[\s.-]\d{4}\b|(?:\+?55[\s.-]?)?\(\d{2}\)\s?9?\d{8}\b|\+?\b55\d{10,11}\b/g;

export function mascarar(texto: string): string {
  return (
    texto
      .replace(CPF_FORMATADO, "[CPF]")
      // 11 dígitos colados: CPF válido, ou celular com DDD (DD9XXXXXXXX).
      .replace(ONZE_DIGITOS, (m) => (cpfValido(m) ? "[CPF]" : /^\d{2}9/.test(m) ? "[telefone]" : m))
      .replace(TELEFONE, "[telefone]")
  );
}

/** Só CPF: documentos do condomínio podem ter telefones que o síndico quer divulgar (portaria). */
export const mascararCpf = (texto: string) =>
  texto.replace(CPF_FORMATADO, "[CPF]").replace(ONZE_DIGITOS, (m) => (cpfValido(m) ? "[CPF]" : m));
