import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Icon } from "@/components/brand/Icon";
import { statusStripeQuery } from "@/data/faturas";
import { definirPix } from "@/lib/admin-cobranca.functions";
import { erroAmigavel } from "@/lib/utils";

const quando = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "nenhum ainda";

/** Conta Stripe sem chaves na tela: modo, conta, último webhook e o Pix (desligado por padrão). */
export function StripeConnectCard() {
  const { data: st } = useQuery(statusStripeQuery);
  const qc = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function alternarPix(ativo: boolean) {
    setErro(null);
    setSalvando(true);
    try {
      await definirPix({ data: { ativo } });
      await qc.invalidateQueries({ queryKey: statusStripeQuery.queryKey });
    } catch (err) {
      setErro(erroAmigavel(err as Error));
    } finally {
      setSalvando(false);
    }
  }

  const conectado = !!st?.configurado;
  return (
    <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-6">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#635BFF]/10">
          <Icon name="credit_card" className="text-[24px] text-[#635BFF]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-[var(--color-navy)]">Conta Stripe</h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                conectado
                  ? "bg-[var(--color-success-soft)] text-[var(--color-success-strong)]"
                  : "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
              }`}
            >
              <Icon name={conectado ? "check_circle" : "cancel"} className="text-[13px]" />
              {conectado
                ? st.modo === "producao"
                  ? "Produção"
                  : "Teste"
                : "Sem chave configurada"}
            </span>
          </div>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm text-[var(--color-on-surface-variant)] sm:grid-cols-2">
            <div>
              <dt className="inline font-semibold text-[var(--color-navy)]">Conta: </dt>
              <dd className="inline">{st?.conta ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-[var(--color-navy)]">Último webhook: </dt>
              <dd className="inline">{quando(st?.ultimoWebhook ?? null)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-[var(--color-on-surface-variant)]">
            As chaves ficam só nas variáveis do servidor (<code>STRIPE_SECRET_KEY</code>,{" "}
            <code>STRIPE_WEBHOOK_SECRET</code>).
          </p>
        </div>
        <a
          href="https://dashboard.stripe.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden h-10 shrink-0 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)] sm:inline-flex"
        >
          <Icon name="open_in_new" className="text-[16px]" />
          Dashboard
        </a>
      </div>

      <label className="mt-5 flex items-start gap-3 rounded-lg bg-[var(--color-surface-low)] p-3">
        <input
          type="checkbox"
          className="mt-1 accent-[var(--color-brand)]"
          checked={!!st?.pixAtivo}
          disabled={salvando || !st}
          onChange={(e) => alternarPix(e.target.checked)}
        />
        <span className="text-sm text-[var(--color-navy)]">
          <strong>Aceitar Pix nas faturas por e-mail</strong> (boleto e cobranças avulsas).
          <span className="block text-xs text-[var(--color-on-surface-variant)]">
            Desligado por padrão. Pix recorrente no cartão ainda não: depende de confirmação do
            Stripe. Antes de ligar, ative o Pix na conta Stripe.
          </span>
        </span>
      </label>
      {erro ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
