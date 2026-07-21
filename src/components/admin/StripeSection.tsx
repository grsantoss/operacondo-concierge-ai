import { useState } from "react";
import { Icon } from "@/components/brand/Icon";

export function StripeConnectCard() {
  const [connected, setConnected] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const testConn = () => {
    setTesting(true);
    setTestMsg(null);
    setTimeout(() => {
      setTesting(false);
      setTestMsg("Conexão OK — última cobrança sincronizada há 2 min.");
    }, 900);
  };

  return (
    <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-6">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#635BFF]/10">
          <Icon name="credit_card" className="text-[24px] text-[#635BFF]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-[var(--color-navy)]">Conta Stripe — OperaCondo</h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                connected
                  ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                  : "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
              }`}
            >
              <Icon name={connected ? "check_circle" : "cancel"} className="text-[13px]" />
              {connected ? "Conectado" : "Desconectado"}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
            Conta corporativa que centraliza as cobranças recorrentes dos síndicos.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Field label="Publishable key" value="pk_live_51NkOperaCondo…" locked />
        <Field
          label="Secret key"
          value={showKey ? "sk_live_51NkOperaCondoAbCdEfGhIj" : "sk_live_••••••••••••••••••••"}
          locked
          right={
            <button
              onClick={() => setShowKey((v) => !v)}
              className="text-xs font-semibold text-[var(--color-brand)] hover:underline"
            >
              {showKey ? "Ocultar" : "Mostrar"}
            </button>
          }
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={testConn}
          disabled={testing}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover)] disabled:opacity-60"
        >
          <Icon name={testing ? "sync" : "wifi_tethering"} className={`text-[16px] ${testing ? "animate-spin" : ""}`} />
          {testing ? "Testando…" : "Testar conexão"}
        </button>
        <button
          onClick={() => setConnected((v) => !v)}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
        >
          <Icon name={connected ? "link_off" : "link"} className="text-[16px]" />
          {connected ? "Desconectar" : "Reconectar"}
        </button>
        <a
          href="https://dashboard.stripe.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
        >
          <Icon name="open_in_new" className="text-[16px]" />
          Abrir dashboard Stripe
        </a>
      </div>

      {testMsg && (
        <p className="mt-3 rounded-lg bg-[var(--color-success-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-success)]">
          {testMsg}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  locked,
  right,
}: {
  label: string;
  value: string;
  locked?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-semibold text-[var(--color-navy)]">{label}</label>
        {right}
      </div>
      <input
        value={value}
        readOnly={locked}
        className="h-10 w-full rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] px-3 font-mono text-xs text-[var(--color-navy)] outline-none"
      />
    </div>
  );
}
