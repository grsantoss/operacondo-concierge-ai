import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";
import {
  CAT_ICON,
  COLUMNS,
  DEMANDAS,
  PRIO_CLASS,
  type ColumnId,
} from "@/data/demandas";

export const Route = createFileRoute("/app/demandas")({
  head: () => ({ meta: [{ title: "Demandas | Concierge OperaCondo" }] }),
  component: DemandasPage,
});

function DemandasPage() {
  const byColumn: Record<ColumnId, typeof DEMANDAS> = {
    novas: [],
    triagem: [],
    execucao: [],
    resolvidas: [],
  };
  for (const d of DEMANDAS) byColumn[d.column].push(d);

  return (
    <AppShell
      title="Demandas"
      breadcrumbs={[{ label: "OperaCondo" }, { label: "Demandas" }]}
      actions={
        <>
          <div className="hidden items-center gap-1 rounded-lg border border-[var(--color-outline-variant)] bg-white p-1 md:flex">
            <button className="flex items-center gap-1.5 rounded-md bg-[var(--color-navy)] px-3 py-1.5 text-xs font-semibold text-white">
              <Icon name="view_kanban" className="text-[16px]" /> Kanban
            </button>
            <button className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]">
              <Icon name="table_rows" className="text-[16px]" /> Lista
            </button>
          </div>
          <button className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)]">
            <Icon name="add" className="text-[18px]" />
            Nova demanda
          </button>
        </>
      }
    >
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-outline-variant)] bg-white p-3">
        {["Todas", "Crítica", "Alta", "Manutenção", "Segurança", "Limpeza"].map(
          (chip, i) => (
            <button
              key={chip}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                i === 0
                  ? "bg-[var(--color-navy)] text-white"
                  : "bg-[var(--color-surface-mid)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-high)]"
              }`}
            >
              {chip}
            </button>
          ),
        )}
        <div className="ml-auto flex items-center gap-2 text-xs text-[var(--color-on-surface-variant)]">
          <Icon name="filter_alt" className="text-[16px]" /> {DEMANDAS.length}{" "}
          demandas • atualizado agora
        </div>
      </div>

      <div className="custom-scrollbar -mx-2 flex gap-4 overflow-x-auto px-2 pb-4">
        {COLUMNS.map((col) => {
          const cards = byColumn[col.id];
          return (
            <div
              key={col.id}
              className="flex w-[320px] shrink-0 flex-col rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-mid)]/60"
            >
              <header className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${col.accent}`} />
                  <h3 className="text-sm font-semibold text-[var(--color-navy)]">
                    {col.title}
                  </h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[var(--color-on-surface-variant)]">
                    {cards.length}
                  </span>
                </div>
                <button className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-navy)]">
                  <Icon name="more_horiz" className="text-[18px]" />
                </button>
              </header>
              <div className="flex flex-col gap-3 px-3 pb-3">
                {cards.map((c) => (
                  <Link
                    key={c.id}
                    to="/app/demandas/$id"
                    params={{ id: c.id }}
                    preload="intent"
                    className="group block rounded-xl border border-[var(--color-outline-variant)] bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--color-brand)] hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-semibold text-[var(--color-on-surface-variant)]">
                        {c.id}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PRIO_CLASS[c.priority]}`}
                      >
                        {c.priority}
                      </span>
                    </div>
                    <h4 className="mt-2 text-sm font-semibold leading-snug text-[var(--color-navy)] group-hover:text-[var(--color-brand)]">
                      {c.title}
                    </h4>
                    <div className="mt-2 flex items-center gap-2 text-xs text-[var(--color-on-surface-variant)]">
                      <Icon
                        name={CAT_ICON[c.category]}
                        className="text-[14px]"
                      />
                      {c.category}
                      <span className="text-[var(--color-outline)]">•</span>
                      {c.unit}
                    </div>
                    <footer className="mt-3 flex items-center justify-between border-t border-[var(--color-outline-variant)] pt-2.5">
                      <div className="flex items-center gap-2">
                        <div className="grid h-6 w-6 place-items-center rounded-full bg-[var(--color-navy)] text-[9px] font-bold text-white">
                          {c.morador
                            .split(" ")
                            .map((s) => s[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <span className="text-[11px] text-[var(--color-on-surface-variant)]">
                          {c.morador}
                        </span>
                      </div>
                      <span className="text-[10px] text-[var(--color-on-surface-variant)]">
                        {c.age}
                      </span>
                    </footer>
                    {c.sla || c.assigned ? (
                      <div className="mt-2 flex items-center gap-2 text-[10px]">
                        {c.sla ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 font-semibold text-red-700">
                            <Icon name="schedule" className="text-[12px]" />
                            {c.sla}
                          </span>
                        ) : null}
                        {c.assigned ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700">
                            <Icon name="person" className="text-[12px]" />
                            {c.assigned}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </Link>
                ))}
                <button className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-outline-variant)] py-2.5 text-xs font-semibold text-[var(--color-on-surface-variant)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]">
                  <Icon name="add" className="text-[16px]" /> Adicionar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
