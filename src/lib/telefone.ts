/**
 * Telefone guardado sempre em E.164 (+5511999990000). Número brasileiro sem DDI (10 ou 11
 * dígitos) ganha o 55. Devolve null se não der para formar um número válido.
 */
export function paraE164(entrada: string | null | undefined): string | null {
  const temMais = (entrada ?? "").trim().startsWith("+");
  let d = (entrada ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (!temMais && d.startsWith("0")) d = d.replace(/^0+/, "");
  if (!temMais && (d.length === 10 || d.length === 11)) d = `55${d}`;
  return /^[1-9]\d{7,14}$/.test(d) ? `+${d}` : null;
}

/** +5511999881204 → "+55 11 99988-1204". Outros países ficam como estão. */
export function formatarTelefone(e164: string | null | undefined): string {
  if (!e164) return "—";
  const m = e164.match(/^\+55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+55 ${m[1]} ${m[2]}-${m[3]}` : e164;
}
