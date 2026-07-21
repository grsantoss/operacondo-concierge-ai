import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/brand/Icon";
import { isAdminMaster, setAdminMaster } from "@/lib/admin";

export const Route = createFileRoute("/admin/configuracoes")({
  head: () => ({
    meta: [{ title: "Configurações — Admin Master | OperaCondo" }],
  }),
  component: AdminConfig,
});

function AdminConfig() {
  const [master, setMaster] = useState(isAdminMaster());
  const [notify, setNotify] = useState({ churn: true, fatura: true, novoTenant: false });

  return (
    <AdminShell title="Configurações do portal" breadcrumbs={[{ label: "Admin", to: "/admin" }, { label: "Configurações" }]}>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <Icon name="shield_person" className="text-[20px] text-[var(--color-brand)]" />
            <h2 className="text-base font-bold text-[var(--color-navy)]">Acesso Admin Master</h2>
          </div>
          <label className="flex items-center gap-3 rounded-lg bg-[var(--color-surface-low)] p-3">
            <input
              type="checkbox"
              checked={master}
              onChange={(e) => {
                setMaster(e.target.checked);
                setAdminMaster(e.target.checked);
              }}
              className="accent-[var(--color-brand)]"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--color-navy)]">Meu usuário é Admin Master</p>
              <p className="text-xs text-[var(--color-on-surface-variant)]">Controla a visibilidade do link "Portal Admin" no menu do usuário.</p>
            </div>
          </label>
        </div>

        <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <Icon name="notifications" className="text-[20px] text-[var(--color-brand)]" />
            <h2 className="text-base font-bold text-[var(--color-navy)]">Alertas</h2>
          </div>
          <div className="space-y-2">
            {[
              { k: "churn" as const, label: "Alerta de churn (tenant suspenso ou downgrade)" },
              { k: "fatura" as const, label: "Cobrança vencida ou falha no Stripe" },
              { k: "novoTenant" as const, label: "Novo tenant provisionado" },
            ].map((x) => (
              <label key={x.k} className="flex items-center gap-3 rounded-lg bg-[var(--color-surface-low)] p-3">
                <input
                  type="checkbox"
                  checked={notify[x.k]}
                  onChange={(e) => setNotify((s) => ({ ...s, [x.k]: e.target.checked }))}
                  className="accent-[var(--color-brand)]"
                />
                <span className="text-sm text-[var(--color-navy)]">{x.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
