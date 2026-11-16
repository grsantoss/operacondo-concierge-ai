/** Número pessoal do síndico para receber os alertas de urgência (regras fixas) pelo WhatsApp. */
import { useState } from "react";
import { useMeuAlerta } from "@/data/whatsapp";

export function AlertaUrgencia() {
  const { telefone, carregando, salvar } = useMeuAlerta();
  if (carregando) return null;
  // Sem key: ao salvar, o formulário continua montado e mostra a confirmação.
  return <Form inicial={telefone} salvar={salvar} />;
}

function Form({ inicial, salvar }: { inicial: string; salvar: (t: string) => Promise<void> }) {
  const [v, setV] = useState(inicial);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  return (
    <form
      className="card-elev mt-4 rounded-2xl p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setOcupado(true);
        setMsg(null);
        salvar(v)
          .then(() => setMsg({ ok: true, t: v ? "Número salvo." : "Alertas só no painel." }))
          .catch((err: Error) => setMsg({ ok: false, t: err.message }))
          .finally(() => setOcupado(false));
      }}
    >
      <h3 className="text-sm font-semibold text-[var(--color-navy)]">Alertas de urgência</h3>
      <p className="mt-0.5 text-xs text-[var(--color-on-surface-variant)]">
        Gás, incêndio, alguém preso no elevador ou vazamento: o Concierge avisa na hora, sem esperar
        a IA. Informe o seu WhatsApp pessoal (não o número do condomínio). Sem número, o alerta
        aparece só no painel.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block min-w-0 flex-1">
          <span className="mb-1 block text-xs font-semibold text-[var(--color-navy)]">
            Meu WhatsApp para alertas
          </span>
          <input
            inputMode="tel"
            placeholder="(11) 98888-7777"
            value={v}
            onChange={(e) => setV(e.target.value)}
            className="h-10 w-full rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15"
          />
        </label>
        <button
          type="submit"
          disabled={ocupado}
          className="btn-press inline-flex h-10 items-center rounded-lg bg-[var(--color-brand)] px-4 text-xs font-semibold text-white hover:bg-[var(--color-brand-hover)] disabled:opacity-60"
        >
          {ocupado ? "Salvando…" : "Salvar"}
        </button>
      </div>
      {msg ? (
        <p
          role={msg.ok ? "status" : "alert"}
          className={`mt-2 text-xs ${msg.ok ? "text-success-strong" : "text-destructive"}`}
        >
          {msg.t}
        </p>
      ) : null}
    </form>
  );
}
