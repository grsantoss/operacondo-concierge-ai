import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";
import { ConfirmDialog } from "@/components/moradores/ConfirmDialog";
import {
  CONDOMINIOS,
  deleteAllInactive,
  deleteMorador,
  formatEndereco,
  initials,
  reactivateMorador,
  useMoradores,
  type Morador,
} from "@/data/moradores";

export const Route = createFileRoute("/app/moradores/arquivados")({
  head: () => ({ meta: [{ title: "Moradores arquivados | OperaCondo" }] }),
  component: ArquivadosPage,
});

function ArquivadosPage() {
  const all = useMoradores({ includeInactive: true });
  const arquivados = useMemo(
    () => all.filter((m) => m.status === "Inativo"),
    [all],
  );
  const [query, setQuery] = useState("");
  const [condoId, setCondoId] = useState<string>("all");
  const [toDelete, setToDelete] = useState<Morador | null>(null);
  const [toReactivate, setToReactivate] = useState<Morador | null>(null);
  const [purgeAll, setPurgeAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return arquivados.filter((m) => {
      if (condoId !== "all" && m.condominioId !== condoId) return false;
      if (!q) return true;
      return (
        m.nome.toLowerCase().includes(q) ||
        m.contato.toLowerCase().includes(q) ||
        (m.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [arquivados, condoId, query]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <AppShell
      title="Moradores arquivados"
      breadcrumbs={[
        { label: "OperaCondo" },
        { label: "Moradores", to: "/app/moradores" },
        { label: "Arquivados" },
      ]}
      actions={
        <>
          <Link
            to="/app/moradores"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
          >
            <Icon name="arrow_back" className="text-[18px]" /> Voltar
          </Link>
          <button
            disabled={arquivados.length === 0}
            onClick={() => setPurgeAll(true)}
            className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="delete_forever" className="text-[18px]" /> Excluir todos ({arquivados.length})
          </button>
        </>
      }
    >
      {/* Info banner */}
      <section className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <Icon name="inventory_2" className="text-[22px] text-amber-700" />
        <div className="text-sm">
          <p className="font-semibold text-amber-900">
            Moradores desativados
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            Esses registros ficam ocultos da listagem principal. Você pode reativá-los
            individualmente ou excluir todos para higienizar a base.
          </p>
        </div>
      </section>

      {/* Filters */}
      <div className="mb-4 rounded-xl border border-[var(--color-outline-variant)] bg-white p-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 py-2 text-sm">
            <Icon name="apartment" className="text-[18px] text-[var(--color-brand)]" />
            <select
              value={condoId}
              onChange={(e) => setCondoId(e.target.value)}
              className="bg-transparent text-sm font-semibold text-[var(--color-navy)] outline-none"
            >
              <option value="all">Todos os condomínios</option>
              {CONDOMINIOS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="relative min-w-[240px] flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--color-on-surface-variant)]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, e-mail, telefone…"
              className="w-full rounded-lg border border-[var(--color-outline-variant)] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card-elev overflow-hidden rounded-2xl">
        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-[var(--color-surface-low)] text-[var(--color-on-surface-variant)]">
              <tr className="text-[11px] uppercase tracking-wider">
                <th className="px-5 py-3 font-semibold">Morador</th>
                <th className="px-5 py-3 font-semibold">Condomínio</th>
                <th className="px-5 py-3 font-semibold">Unidade</th>
                <th className="px-5 py-3 font-semibold">Desativado em</th>
                <th className="px-5 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-outline-variant)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--color-surface-mid)] text-[var(--color-on-surface-variant)]">
                      <Icon name="inventory_2" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[var(--color-navy)]">
                      {arquivados.length === 0
                        ? "Nenhum morador arquivado"
                        : "Nenhum resultado para os filtros aplicados"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
                      {arquivados.length === 0
                        ? "Quando um morador é desativado, aparecerá aqui."
                        : "Ajuste a busca ou o condomínio selecionado."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const condo = CONDOMINIOS.find((c) => c.id === m.condominioId)!;
                  const end = formatEndereco(m.endereco);
                  return (
                    <tr key={m.id} className="bg-white hover:bg-[var(--color-surface-low)]">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-700">
                            {initials(m.nome)}
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--color-navy)]">
                              {m.nome}
                            </p>
                            <p className="text-xs text-[var(--color-on-surface-variant)]">
                              {m.contato}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[var(--color-navy)]">
                        {condo.nome}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[var(--color-on-surface-variant)]">
                        {end.full}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[var(--color-on-surface-variant)]">
                        {m.desativadoEm ?? "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setToReactivate(m)}
                            title="Reativar"
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--color-outline-variant)] bg-white px-2.5 text-xs font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
                          >
                            <Icon name="person_check" className="text-[14px]" /> Reativar
                          </button>
                          <button
                            onClick={() => setToDelete(m)}
                            title="Excluir"
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-red-600 px-2.5 text-xs font-semibold text-white hover:bg-red-700"
                          >
                            <Icon name="delete" className="text-[14px]" /> Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={!!toReactivate}
        title={`Reativar ${toReactivate?.nome}?`}
        description="O morador voltará como Residente e ficará visível novamente na listagem principal."
        confirmLabel="Reativar"
        tone="brand"
        icon="person_check"
        onClose={() => setToReactivate(null)}
        onConfirm={() => {
          if (toReactivate) {
            reactivateMorador(toReactivate.id);
            flash(`${toReactivate.nome} reativado.`);
          }
          setToReactivate(null);
        }}
      />

      <ConfirmDialog
        open={!!toDelete}
        title={`Excluir ${toDelete?.nome}?`}
        description="Esta ação é permanente e não pode ser desfeita."
        confirmLabel="Excluir definitivamente"
        tone="danger"
        icon="delete_forever"
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) {
            deleteMorador(toDelete.id);
            flash(`${toDelete.nome} excluído.`);
          }
          setToDelete(null);
        }}
      />

      <ConfirmDialog
        open={purgeAll}
        title={`Excluir todos os ${arquivados.length} arquivados?`}
        description="Todos os moradores desativados serão removidos definitivamente da base."
        confirmLabel="Excluir todos"
        tone="danger"
        icon="delete_sweep"
        requireCheckboxLabel="Entendo que esta ação é permanente e não pode ser desfeita."
        onClose={() => setPurgeAll(false)}
        onConfirm={() => {
          const n = arquivados.length;
          deleteAllInactive();
          setPurgeAll(false);
          flash(`${n} morador(es) excluído(s).`);
        }}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-[var(--color-navy)] px-4 py-3 text-sm font-semibold text-white shadow-lg">
          <Icon name="check_circle" className="text-[18px]" filled />
          {toast}
        </div>
      )}
    </AppShell>
  );
}
