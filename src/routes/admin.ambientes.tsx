import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/brand/Icon";
import { useTenants } from "@/data/tenants";

export const Route = createFileRoute("/admin/ambientes")({
  head: () => ({
    meta: [
      { title: "Ambientes — Admin Master | OperaCondo" },
      { name: "description", content: "Feature flags globais e overrides por tenant." },
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
  const [limits, setLimits] = useState({ starter: 200, pro: 800, enterprise: 5000 });

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

          <div className="mt-6 border-t border-[var(--color-outline-variant)] pt-5">
            <h3 className="text-sm font-bold text-[var(--color-navy)]">Limites padrão por plano</h3>
            <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">Moradores máximos.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {(["starter", "pro", "enterprise"] as const).map((p) => (
                <label key={p} className="block">
                  <span className="mb-1 block text-xs font-semibold capitalize text-[var(--color-navy)]">{p}</span>
                  <input
                    type="number"
                    value={limits[p]}
                    onChange={(e) => setLimits((s) => ({ ...s, [p]: Number(e.target.value) }))}
                    className="h-10 w-full rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm outline-none"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Icon name="tune" className="text-[20px] text-[var(--color-brand)]" />
              <h2 className="text-base font-bold text-[var(--color-navy)]">Overrides por tenant</h2>
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
