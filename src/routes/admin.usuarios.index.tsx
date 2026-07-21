import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/brand/Icon";
import { ConfirmDialog } from "@/components/moradores/ConfirmDialog";
import { useTenants, deleteTenant, updateTenant, type TenantStatus } from "@/data/tenants";
import { PLANOS, getPlano, type PlanoId } from "@/data/planos";
import { formatBRL } from "@/data/faturas";

export const Route = createFileRoute("/admin/usuarios/")({
  head: () => ({
    meta: [
      { title: "Usuários — Admin Master | OperaCondo" },
      { name: "description", content: "Gestão de tenants: criar, editar, suspender e excluir contas." },
    ],
  }),
  component: UsuariosList,
});

const STATUS_LABEL: Record<TenantStatus, string> = {
  ativo: "Ativo",
  trial: "Trial",
  suspenso: "Suspenso",
};

const STATUS_TONE: Record<TenantStatus, string> = {
  ativo: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  trial: "bg-[var(--color-info-soft)] text-[var(--color-brand)]",
  suspenso: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
};

function UsuariosList() {
  const navigate = useNavigate();
  const tenants = useTenants();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"todos" | TenantStatus>("todos");
  const [plano, setPlano] = useState<"todos" | PlanoId>("todos");
  const [toDelete, setToDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return tenants.filter((t) => {
      if (status !== "todos" && t.status !== status) return false;
      if (plano !== "todos" && t.plano !== plano) return false;
      if (q) {
        const s = q.toLowerCase();
        if (
          !t.nomeFantasia.toLowerCase().includes(s) &&
          !t.razaoSocial.toLowerCase().includes(s) &&
          !t.cnpj.includes(s) &&
          !t.email.toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [tenants, q, status, plano]);

  const target = tenants.find((t) => t.id === toDelete);

  return (
    <AdminShell
      title="Usuários (tenants)"
      breadcrumbs={[{ label: "Admin", to: "/admin" }, { label: "Usuários" }]}
      actions={
        <Link
          to="/admin/usuarios/novo"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover)]"
        >
          <Icon name="add" className="text-[18px]" />
          Novo usuário
        </Link>
      }
    >
      <div className="mb-4 grid gap-3 rounded-2xl border border-[var(--color-outline-variant)] bg-white p-4 md:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[var(--color-on-surface-variant)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, CNPJ ou e-mail…"
            className="h-10 w-full rounded-lg border border-[var(--color-outline-variant)] bg-white pl-10 pr-3 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="h-10 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm outline-none"
        >
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="trial">Trial</option>
          <option value="suspenso">Suspensos</option>
        </select>
        <select
          value={plano}
          onChange={(e) => setPlano(e.target.value as typeof plano)}
          className="h-10 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm outline-none"
        >
          <option value="todos">Todos os planos</option>
          {PLANOS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-low)] text-left text-xs uppercase tracking-wider text-[var(--color-on-surface-variant)]">
              <tr>
                <th className="px-5 py-3">Tenant</th>
                <th className="px-5 py-3">Plano</th>
                <th className="px-5 py-3">MRR</th>
                <th className="px-5 py-3">Uso</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const p = getPlano(t.plano);
                const pct = Math.min(100, Math.round((t.uso.msgs / p.msgsMes) * 100));
                return (
                  <tr
                    key={t.id}
                    className="cursor-pointer border-t border-[var(--color-outline-variant)] hover:bg-[var(--color-surface-mid)]"
                    onClick={() => navigate({ to: "/admin/usuarios/$id", params: { id: t.id } })}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-navy)] text-xs font-bold text-white">
                          {t.nomeFantasia.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--color-navy)]">{t.nomeFantasia}</p>
                          <p className="truncate text-[11px] text-[var(--color-on-surface-variant)]">
                            {t.cnpj} · {t.cidade}/{t.uf}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-md bg-[var(--color-surface-mid)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-navy)]">
                        {p.nome}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-semibold text-[var(--color-navy)]">{formatBRL(t.mrr)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--color-surface-mid)]">
                          <div
                            className="h-full bg-[var(--color-brand)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-[var(--color-on-surface-variant)]">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[t.status]}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        <Link
                          to="/admin/usuarios/$id"
                          params={{ id: t.id }}
                          title="Editar"
                          className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
                        >
                          <Icon name="edit" className="text-[16px]" />
                        </Link>
                        <button
                          title={t.status === "suspenso" ? "Reativar" : "Suspender"}
                          onClick={() =>
                            updateTenant(t.id, {
                              status: t.status === "suspenso" ? "ativo" : "suspenso",
                              apiStatus: t.status === "suspenso" ? "ativa" : "revogada",
                              mrr: t.status === "suspenso" ? getPlano(t.plano).precoMensal : 0,
                            })
                          }
                          className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
                        >
                          <Icon name={t.status === "suspenso" ? "play_arrow" : "pause"} className="text-[16px]" />
                        </button>
                        <button
                          title="Excluir"
                          onClick={() => setToDelete(t.id)}
                          className="grid h-8 w-8 place-items-center rounded-md text-red-600 hover:bg-red-50"
                        >
                          <Icon name="delete" className="text-[16px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--color-on-surface-variant)]">
                    Nenhum tenant encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title={`Excluir ${target?.nomeFantasia ?? "tenant"}?`}
        description="Todos os dados desta conta serão removidos permanentemente, incluindo API Key e histórico de cobranças (mock)."
        confirmLabel="Excluir tenant"
        requireCheckboxLabel="Entendo que esta ação é irreversível."
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) deleteTenant(toDelete);
          setToDelete(null);
        }}
      />
    </AdminShell>
  );
}
