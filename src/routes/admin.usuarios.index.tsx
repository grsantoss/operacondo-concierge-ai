import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/brand/Icon";
import { formatBRL } from "@/data/faturas";
import { planosQuery, usePlanos } from "@/data/planos";
import { clientesQuery, STATUS_CLIENTE, useTenants, type TenantStatus } from "@/data/tenants";

export const Route = createFileRoute("/admin/usuarios/")({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(clientesQuery),
      queryClient.ensureQueryData(planosQuery),
    ]),
  head: () => ({
    meta: [
      { title: "Usuários — Admin Master | OperaCondo" },
      { name: "description", content: "Clientes da plataforma: cadastro, plano, uso e usuários." },
    ],
  }),
  component: UsuariosList,
});

function UsuariosList() {
  const navigate = useNavigate();
  const tenants = useTenants();
  const planos = usePlanos();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"todos" | TenantStatus>("todos");
  const [plano, setPlano] = useState("todos");

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

  return (
    <AdminShell
      title="Clientes"
      breadcrumbs={[{ label: "Admin", to: "/admin" }, { label: "Clientes" }]}
      actions={
        <Link
          to="/admin/usuarios/novo"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover)]"
        >
          <Icon name="add" className="text-[18px]" />
          Novo cliente
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
          {Object.entries(STATUS_CLIENTE).map(([id, st]) => (
            <option key={id} value={id}>
              {st.label}
            </option>
          ))}
        </select>
        <select
          value={plano}
          onChange={(e) => setPlano(e.target.value)}
          className="h-10 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm outline-none"
        >
          <option value="todos">Todos os planos</option>
          {planos.map((p) => (
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
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Plano</th>
                <th className="px-5 py-3">MRR</th>
                <th className="px-5 py-3">Respostas da IA no mês</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const p = planos.find((x) => x.id === t.plano);
                const pct = p ? Math.min(100, Math.round((t.uso.respostasIa / p.respostasIaMes) * 100)) : 0;
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
                        {p?.nome ?? "—"}
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
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_CLIENTE[t.status].tone}`}>
                        {STATUS_CLIENTE[t.status].label}
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
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--color-on-surface-variant)]">
                    Nenhum cliente encontrado com os filtros atuais.
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
