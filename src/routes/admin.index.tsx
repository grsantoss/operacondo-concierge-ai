import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/brand/Icon";
import { useTenants } from "@/data/tenants";
import { useFaturas, STATUS_LABEL, STATUS_TONE, formatBRL } from "@/data/faturas";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Master — Dashboard | OperaCondo" },
      { name: "description", content: "Visão executiva multi-tenant: MRR, tenants ativos e cobranças." },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const tenants = useTenants();
  const faturas = useFaturas();

  const mrr = tenants.filter((t) => t.status === "ativo").reduce((a, t) => a + t.mrr, 0);
  const arr = mrr * 12;
  const ativos = tenants.filter((t) => t.status === "ativo").length;
  const trial = tenants.filter((t) => t.status === "trial").length;
  const suspensos = tenants.filter((t) => t.status === "suspenso").length;
  const ticket = ativos > 0 ? mrr / ativos : 0;
  const churn = tenants.length > 0 ? (suspensos / tenants.length) * 100 : 0;

  const kpis = [
    { label: "MRR", value: formatBRL(mrr), delta: "+12% vs mês passado", icon: "trending_up", tone: "brand" },
    { label: "ARR projetado", value: formatBRL(arr), delta: "Baseado em ativos", icon: "insights", tone: "success" },
    { label: "Tenants ativos", value: String(ativos), delta: `${trial} trial · ${suspensos} suspensos`, icon: "apartment", tone: "brand" },
    { label: "Churn", value: `${churn.toFixed(1)}%`, delta: "Últimos 30 dias", icon: "trending_down", tone: churn > 5 ? "danger" : "success" },
    { label: "Ticket médio", value: formatBRL(ticket), delta: "Por tenant ativo", icon: "receipt_long", tone: "brand" },
  ];

  const top = [...tenants].sort((a, b) => b.mrr - a.mrr).slice(0, 5);
  const recentes = [...faturas].sort((a, b) => b.emissao.localeCompare(a.emissao)).slice(0, 8);

  return (
    <AdminShell
      title="Dashboard financeiro"
      breadcrumbs={[{ label: "Admin", to: "/admin" }, { label: "Dashboard" }]}
      actions={
        <Link
          to="/admin/financeiro"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover)]"
        >
          <Icon name="payments" className="text-[18px]" />
          Financeiro
        </Link>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                {k.label}
              </p>
              <div
                className={`grid h-9 w-9 place-items-center rounded-lg ${
                  k.tone === "success"
                    ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                    : k.tone === "danger"
                      ? "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
                      : "bg-[var(--color-info-soft)] text-[var(--color-brand)]"
                }`}
              >
                <Icon name={k.icon} className="text-[18px]" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-[var(--color-navy)]">{k.value}</p>
            <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">{k.delta}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--color-navy)]">Receita mensal (últimos 6 meses)</h2>
            <span className="text-xs text-[var(--color-on-surface-variant)]">mock</span>
          </div>
          <RevenueChart />
        </div>

        <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-6">
          <h2 className="mb-4 text-base font-bold text-[var(--color-navy)]">Top 5 por MRR</h2>
          <div className="space-y-3">
            {top.map((t, i) => (
              <Link
                key={t.id}
                to="/admin/usuarios/$id"
                params={{ id: t.id }}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[var(--color-surface-mid)]"
              >
                <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-navy)] text-xs font-bold text-white">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-navy)]">{t.nomeFantasia}</p>
                  <p className="truncate text-[11px] text-[var(--color-on-surface-variant)]">
                    {t.cidade}/{t.uf}
                  </p>
                </div>
                <span className="text-sm font-bold text-[var(--color-brand)]">{formatBRL(t.mrr)}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[var(--color-outline-variant)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--color-outline-variant)] p-5">
          <h2 className="text-base font-bold text-[var(--color-navy)]">Últimas cobranças</h2>
          <Link to="/admin/financeiro" className="text-xs font-semibold text-[var(--color-brand)] hover:underline">
            Ver todas →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-low)] text-left text-xs uppercase tracking-wider text-[var(--color-on-surface-variant)]">
              <tr>
                <th className="px-5 py-3">Tenant</th>
                <th className="px-5 py-3">Período</th>
                <th className="px-5 py-3">Valor</th>
                <th className="px-5 py-3">Método</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentes.map((f) => {
                const t = tenants.find((x) => x.id === f.tenantId);
                return (
                  <tr key={f.id} className="border-t border-[var(--color-outline-variant)]">
                    <td className="px-5 py-3 font-semibold text-[var(--color-navy)]">
                      {t?.nomeFantasia ?? f.tenantId}
                    </td>
                    <td className="px-5 py-3 text-[var(--color-on-surface-variant)]">{f.periodo}</td>
                    <td className="px-5 py-3 font-semibold text-[var(--color-navy)]">{formatBRL(f.valor)}</td>
                    <td className="px-5 py-3 uppercase text-[11px] text-[var(--color-on-surface-variant)]">
                      {f.metodo}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[f.status]}`}>
                        {STATUS_LABEL[f.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

function RevenueChart() {
  const data = [
    { m: "Mar", v: 2100 },
    { m: "Abr", v: 2400 },
    { m: "Mai", v: 2700 },
    { m: "Jun", v: 2900 },
    { m: "Jul", v: 3200 },
    { m: "Ago", v: 3297 },
  ];
  const max = Math.max(...data.map((d) => d.v));
  const w = 560;
  const h = 180;
  const pad = 24;
  const step = (w - pad * 2) / (data.length - 1);
  const points = data
    .map((d, i) => `${pad + i * step},${h - pad - (d.v / max) * (h - pad * 2)}`)
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-48 w-full min-w-[520px]">
        <defs>
          <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`${pad},${h - pad} ${points} ${w - pad},${h - pad}`} fill="url(#rg)" />
        <polyline points={points} fill="none" stroke="var(--color-brand)" strokeWidth="2.5" />
        {data.map((d, i) => (
          <g key={d.m}>
            <circle cx={pad + i * step} cy={h - pad - (d.v / max) * (h - pad * 2)} r="4" fill="var(--color-brand)" />
            <text x={pad + i * step} y={h - 6} textAnchor="middle" className="fill-[var(--color-on-surface-variant)]" style={{ fontSize: 11 }}>
              {d.m}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
