import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/brand/Icon";
import { formatBRL } from "@/data/faturas";
import {
  planosQuery,
  usePlanos,
  useSalvarLimitesPlano,
  type LimitesPlano,
  type Plano,
} from "@/data/planos";
import { clientesQuery, erroAmigavel, useTenants } from "@/data/tenants";

export const Route = createFileRoute("/admin/ambientes")({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(clientesQuery),
      queryClient.ensureQueryData(planosQuery),
    ]),
  head: () => ({
    meta: [
      { title: "Ambientes — Admin Master | OperaCondo" },
      { name: "description", content: "Funções liberadas para todos e ajustes por cliente." },
    ],
  }),
  component: AmbientesPage,
});

interface Flag {
  key: string;
  label: string;
  desc: string;
  on: boolean;
}

const GLOBAL_FLAGS_DEFAULT: Flag[] = [
  { key: "ai_autonomia", label: "IA em modo autônomo", desc: "Permite que o agente responda sem revisão do síndico.", on: true },
  { key: "wpp_meta", label: "WhatsApp Meta Cloud API", desc: "Habilita o provedor oficial Meta além do Z-API.", on: true },
  { key: "beta_analytics", label: "Beta: Analytics avançado", desc: "Dashboards experimentais com previsão de demandas.", on: false },
  { key: "beta_voip", label: "Beta: Chamadas VoIP", desc: "Ligações via app para moradores.", on: false },
  { key: "export_csv", label: "Exportação CSV", desc: "Permite exportar demandas, moradores e cobranças.", on: true },
];

function AmbientesPage() {
  const tenants = useTenants();
  const [flags, setFlags] = useState<Flag[]>(GLOBAL_FLAGS_DEFAULT);
  const [tenantId, setTenantId] = useState<string>(tenants[0]?.id ?? "");
  const [overrides, setOverrides] = useState<Record<string, Record<string, boolean>>>({});

  const toggleGlobal = (key: string) =>
    setFlags((fs) => fs.map((f) => (f.key === key ? { ...f, on: !f.on } : f)));

  const toggleOverride = (key: string) => {
    setOverrides((o) => {
      const cur = o[tenantId] ?? {};
      const base = flags.find((f) => f.key === key)?.on ?? false;
      const currentValue = cur[key] ?? base;
      return { ...o, [tenantId]: { ...cur, [key]: !currentValue } };
    });
  };

  const currentOverrides = overrides[tenantId] ?? {};

  return (
    <AdminShell
      title="Configuração de ambientes"
      breadcrumbs={[{ label: "Admin", to: "/admin" }, { label: "Ambientes" }]}
    >
      <PlanosLimites />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <Icon name="public" className="text-[20px] text-[var(--color-brand)]" />
            <h2 className="text-base font-bold text-[var(--color-navy)]">Feature flags globais</h2>
          </div>
          <p className="mb-4 text-sm text-[var(--color-on-surface-variant)]">
            Ativam ou desativam funcionalidades para toda a plataforma.
          </p>
          <div className="space-y-2">
            {flags.map((f) => (
              <FlagRow key={f.key} flag={f} onToggle={() => toggleGlobal(f.key)} />
            ))}
          </div>

        </div>

        <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Icon name="tune" className="text-[20px] text-[var(--color-brand)]" />
              <h2 className="text-base font-bold text-[var(--color-navy)]">Ajustes por cliente</h2>
            </div>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="h-9 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm outline-none"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nomeFantasia}
                </option>
              ))}
            </select>
          </div>
          <p className="mb-4 text-sm text-[var(--color-on-surface-variant)]">
            Sobrescreve as flags globais para este tenant. Útil para liberar betas antecipados ou restringir clientes específicos.
          </p>
          <div className="space-y-2">
            {flags.map((f) => {
              const overridden = currentOverrides[f.key] !== undefined;
              const value = overridden ? currentOverrides[f.key] : f.on;
              return (
                <div
                  key={f.key}
                  className={`rounded-lg border p-3 ${overridden ? "border-[var(--color-brand)] bg-[var(--color-info-soft)]" : "border-[var(--color-outline-variant)] bg-[var(--color-surface-low)]"}`}
                >
                  <FlagRow flag={{ ...f, on: value }} onToggle={() => toggleOverride(f.key)} noBg />
                  {overridden && (
                    <p className="mt-1 text-[10px] font-semibold uppercase text-[var(--color-brand)]">Sobrescrito</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function FlagRow({ flag, onToggle, noBg }: { flag: Flag; onToggle: () => void; noBg?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg p-3 ${noBg ? "" : "bg-[var(--color-surface-low)]"}`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--color-navy)]">{flag.label}</p>
        <p className="text-xs text-[var(--color-on-surface-variant)]">{flag.desc}</p>
      </div>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={flag.on}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${flag.on ? "bg-[var(--color-brand)]" : "bg-[var(--color-surface-mid)]"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${flag.on ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}

const CAMPOS: { k: keyof LimitesPlano; label: string }[] = [
  { k: "condominios", label: "Condomínios" },
  { k: "moradores", label: "Moradores" },
  { k: "documentos", label: "Documentos" },
  { k: "respostasIaMes", label: "Respostas da IA/mês" },
];

/** Limites de cada plano, lidos e gravados na tabela `planos`. */
function PlanosLimites() {
  const planos = usePlanos();
  return (
    <div className="mb-6 rounded-2xl border border-[var(--color-outline-variant)] bg-white">
      <div className="border-b border-[var(--color-outline-variant)] p-5">
        <h2 className="text-base font-bold text-[var(--color-navy)]">Planos e limites</h2>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          Valem para todos os clientes do plano. O preço é só para exibir: o valor cobrado é o do Stripe.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-low)] text-left text-xs uppercase text-[var(--color-on-surface-variant)]">
            <tr>
              <th className="px-5 py-3">Plano</th>
              {CAMPOS.map((c) => (
                <th key={c.k} className="px-3 py-3">
                  {c.label}
                </th>
              ))}
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {planos.map((p) => (
              <PlanoLinha key={p.id} p={p} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlanoLinha({ p }: { p: Plano }) {
  const salvar = useSalvarLimitesPlano();
  const inicial = { condominios: p.condominios, moradores: p.moradores, documentos: p.documentos, respostasIaMes: p.respostasIaMes };
  const [l, setL] = useState<LimitesPlano>(inicial);
  const [msg, setMsg] = useState<string | null>(null);
  const mudou = CAMPOS.some((c) => l[c.k] !== inicial[c.k]);
  return (
    <tr className="border-t border-[var(--color-outline-variant)]">
      <td className="px-5 py-3">
        <p className="font-semibold text-[var(--color-navy)]">{p.nome}</p>
        <p className="text-[11px] text-[var(--color-on-surface-variant)]">
          {p.vendavel ? `${formatBRL(p.precoMensal)}/mês` : "Interno (trial)"}
        </p>
      </td>
      {CAMPOS.map((c) => (
        <td key={c.k} className="px-3 py-3">
          <input
            type="number"
            min={0}
            aria-label={`${c.label} — ${p.nome}`}
            value={l[c.k]}
            onChange={(e) => setL((s) => ({ ...s, [c.k]: Number(e.target.value) }))}
            className="h-9 w-28 rounded-lg border border-[var(--color-outline-variant)] bg-white px-2 text-sm outline-none focus:border-[var(--color-brand)]"
          />
        </td>
      ))}
      <td className="px-5 py-3 text-right">
        <button
          type="button"
          disabled={!mudou}
          onClick={async () => {
            setMsg(null);
            try {
              await salvar(p.id, l);
              setMsg("Salvo");
            } catch (err) {
              setMsg(erroAmigavel(err));
            }
          }}
          className="h-9 rounded-lg bg-[var(--color-brand)] px-3 text-xs font-semibold text-white disabled:opacity-40"
        >
          Salvar
        </button>
        {msg ? <p className="mt-1 text-[11px] text-[var(--color-on-surface-variant)]">{msg}</p> : null}
      </td>
    </tr>
  );
}
