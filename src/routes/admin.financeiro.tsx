import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/brand/Icon";
import { StripeConnectCard } from "@/components/admin/StripeSection";
import {
  useFaturas,
  updateFaturaStatus,
  STATUS_LABEL,
  STATUS_TONE,
  formatBRL,
  type FaturaStatus,
} from "@/data/faturas";
import { useTenants } from "@/data/tenants";

export const Route = createFileRoute("/admin/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Admin Master | OperaCondo" },
      { name: "description", content: "Cobranças Stripe, inadimplência e exportação financeira." },
    ],
  }),
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const faturas = useFaturas();
  const tenants = useTenants();
  const [status, setStatus] = useState<"todos" | FaturaStatus>("todos");
  const [tenantId, setTenantId] = useState<string>("todos");

  const filtered = useMemo(() => {
    return faturas.filter((f) => {
      if (status !== "todos" && f.status !== status) return false;
      if (tenantId !== "todos" && f.tenantId !== tenantId) return false;
      return true;
    });
  }, [faturas, status, tenantId]);

  const total = filtered.reduce((a, f) => a + f.valor, 0);
  const pagas = filtered.filter((f) => f.status === "paid").reduce((a, f) => a + f.valor, 0);
  const abertas = filtered.filter((f) => f.status === "open").reduce((a, f) => a + f.valor, 0);
  const inadimplencia = filtered.filter((f) => f.status === "past_due").reduce((a, f) => a + f.valor, 0);

  const exportCSV = () => {
    const header = ["ID", "Tenant", "Período", "Valor", "Método", "Status", "Emissão", "Vencimento", "Stripe ID"];
    const rows = filtered.map((f) => {
      const t = tenants.find((x) => x.id === f.tenantId);
      return [
        f.id,
        t?.nomeFantasia ?? f.tenantId,
        f.periodo,
        f.valor.toFixed(2),
        f.metodo,
        STATUS_LABEL[f.status],
        f.emissao,
        f.vencimento,
        f.stripeInvoiceId,
      ];
    });
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell
      title="Financeiro"
      breadcrumbs={[{ label: "Admin", to: "/admin" }, { label: "Financeiro" }]}
      actions={
        <button
          onClick={exportCSV}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
        >
          <Icon name="download" className="text-[16px]" /> Exportar CSV
        </button>
      }
    >
      <div className="mb-6">
        <StripeConnectCard />
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-4">
        <KpiCard label="Total no filtro" value={formatBRL(total)} icon="paid" tone="brand" />
        <KpiCard label="Pagas" value={formatBRL(pagas)} icon="check_circle" tone="success" />
        <KpiCard label="Em aberto" value={formatBRL(abertas)} icon="pending" tone="brand" />
        <KpiCard label="Inadimplência" value={formatBRL(inadimplencia)} icon="warning" tone="danger" />
      </div>

      <div className="mb-4 grid gap-3 rounded-2xl border border-[var(--color-outline-variant)] bg-white p-4 md:grid-cols-[auto_auto_1fr]">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="h-10 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm outline-none"
        >
          <option value="todos">Todos os status</option>
          <option value="paid">Pagas</option>
          <option value="open">Em aberto</option>
          <option value="past_due">Vencidas</option>
          <option value="refunded">Estornadas</option>
          <option value="void">Canceladas</option>
        </select>
        <select
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          className="h-10 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm outline-none"
        >
          <option value="todos">Todos os tenants</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nomeFantasia}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-low)] text-left text-xs uppercase text-[var(--color-on-surface-variant)]">
              <tr>
                <th className="px-5 py-3">Tenant</th>
                <th className="px-5 py-3">Período</th>
                <th className="px-5 py-3">Valor</th>
                <th className="px-5 py-3">Método</th>
                <th className="px-5 py-3">Vencimento</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => {
                const t = tenants.find((x) => x.id === f.tenantId);
                return (
                  <tr key={f.id} className="border-t border-[var(--color-outline-variant)]">
                    <td className="px-5 py-3 font-semibold text-[var(--color-navy)]">{t?.nomeFantasia ?? f.tenantId}</td>
                    <td className="px-5 py-3">{f.periodo}</td>
                    <td className="px-5 py-3 font-semibold">{formatBRL(f.valor)}</td>
                    <td className="px-5 py-3 uppercase text-[11px]">{f.metodo}</td>
                    <td className="px-5 py-3">{f.vencimento}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[f.status]}`}>
                        {STATUS_LABEL[f.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {f.status !== "paid" && (
                          <button
                            title="Marcar como paga"
                            onClick={() => updateFaturaStatus(f.id, "paid")}
                            className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-success)] hover:bg-[var(--color-success-soft)]"
                          >
                            <Icon name="check" className="text-[16px]" />
                          </button>
                        )}
                        {(f.status === "open" || f.status === "past_due") && (
                          <button
                            title="Reenviar cobrança"
                            onClick={() => alert("Cobrança reenviada via Stripe (mock).")}
                            className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-brand)] hover:bg-[var(--color-info-soft)]"
                          >
                            <Icon name="send" className="text-[16px]" />
                          </button>
                        )}
                        {f.status === "paid" && (
                          <button
                            title="Estornar"
                            onClick={() => updateFaturaStatus(f.id, "refunded")}
                            className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-warning)] hover:bg-[var(--color-warning-soft)]"
                          >
                            <Icon name="undo" className="text-[16px]" />
                          </button>
                        )}
                        <a
                          href={`https://dashboard.stripe.com/invoices/${f.stripeInvoiceId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ver no Stripe"
                          className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
                        >
                          <Icon name="open_in_new" className="text-[16px]" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-[var(--color-on-surface-variant)]">
                    Nenhuma cobrança encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

function KpiCard({ label, value, icon, tone }: { label: string; value: string; icon: string; tone: "brand" | "success" | "danger" }) {
  const cls =
    tone === "success"
      ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
      : tone === "danger"
        ? "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
        : "bg-[var(--color-info-soft)] text-[var(--color-brand)]";
  return (
    <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">{label}</p>
        <div className={`grid h-9 w-9 place-items-center rounded-lg ${cls}`}>
          <Icon name={icon} className="text-[18px]" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold text-[var(--color-navy)]">{value}</p>
    </div>
  );
}
