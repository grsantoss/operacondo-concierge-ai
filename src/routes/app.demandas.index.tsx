import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";
import {
  CAT_ICON,
  COLUMNS,
  DEMANDAS,
  PRIO_CLASS,
  type Category,
  type ColumnId,
  type Demanda,
  type Priority,
} from "@/data/demandas";

export const Route = createFileRoute("/app/demandas/")({
  head: () => ({ meta: [{ title: "Demandas | Concierge OperaCondo" }] }),
  component: DemandasPage,
});

type ViewMode = "kanban" | "lista";
type SortKey = "recentes" | "antigas" | "prioridade" | "titulo";
type TempFilter = "todas" | "hot" | "warm" | "cold";
type SlaFilter = "todos" | "com" | "sem";

const CATEGORIAS: Category[] = ["Manutenção", "Segurança", "Limpeza", "Administrativo"];
const PRIORIDADES: Priority[] = ["Crítica", "Alta", "Normal"];

const PRIO_ORDER: Record<Priority, number> = { Crítica: 0, Alta: 1, Normal: 2 };
const COL_ORDER: Record<ColumnId, number> = {
  novas: 0,
  triagem: 1,
  execucao: 2,
  resolvidas: 3,
};

const TEMP_META: Record<
  Exclude<TempFilter, "todas">,
  { label: string; dot: string; cls: string }
> = {
  hot: { label: "Urgente", dot: "bg-red-500", cls: "bg-red-50 text-red-700" },
  warm: { label: "Atenção", dot: "bg-amber-500", cls: "bg-amber-50 text-amber-700" },
  cold: { label: "Tranquilo", dot: "bg-blue-500", cls: "bg-blue-50 text-blue-700" },
};

function DemandasPage() {
  const [view, setView] = useState<ViewMode>("kanban");
  const [query, setQuery] = useState("");
  const [categorias, setCategorias] = useState<Set<Category>>(new Set());
  const [prioridades, setPrioridades] = useState<Set<Priority>>(new Set());
  const [colunas, setColunas] = useState<Set<ColumnId>>(new Set());
  const [temperatura, setTemperatura] = useState<TempFilter>("todas");
  const [sla, setSla] = useState<SlaFilter>("todos");
  const [comAnexo, setComAnexo] = useState(false);
  const [semResponsavel, setSemResponsavel] = useState(false);
  const [sort, setSort] = useState<SortKey>("recentes");

  const activeCount =
    (query ? 1 : 0) +
    categorias.size +
    prioridades.size +
    colunas.size +
    (temperatura !== "todas" ? 1 : 0) +
    (sla !== "todos" ? 1 : 0) +
    (comAnexo ? 1 : 0) +
    (semResponsavel ? 1 : 0);

  function toggle<T>(set: Set<T>, value: T, apply: (s: Set<T>) => void) {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    apply(next);
  }

  function clearAll() {
    setQuery("");
    setCategorias(new Set());
    setPrioridades(new Set());
    setColunas(new Set());
    setTemperatura("todas");
    setSla("todos");
    setComAnexo(false);
    setSemResponsavel(false);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = DEMANDAS.filter((d) => {
      if (categorias.size && !categorias.has(d.category)) return false;
      if (prioridades.size && !prioridades.has(d.priority)) return false;
      if (colunas.size && !colunas.has(d.column)) return false;
      if (temperatura !== "todas" && d.temperature !== temperatura) return false;
      if (sla === "com" && !d.sla) return false;
      if (sla === "sem" && d.sla) return false;
      if (comAnexo && d.attachments.length === 0) return false;
      if (semResponsavel && d.assigned) return false;
      if (q) {
        const hay = `${d.id} ${d.title} ${d.description} ${d.morador} ${d.unit} ${d.location}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list = list.slice().sort((a, b) => {
      switch (sort) {
        case "antigas":
          return COL_ORDER[a.column] - COL_ORDER[b.column] || a.id.localeCompare(b.id);
        case "prioridade":
          return PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority];
        case "titulo":
          return a.title.localeCompare(b.title, "pt-BR");
        case "recentes":
        default:
          return b.id.localeCompare(a.id);
      }
    });
    return list;
  }, [query, categorias, prioridades, colunas, temperatura, sla, comAnexo, semResponsavel, sort]);

  const byColumn: Record<ColumnId, Demanda[]> = {
    novas: [],
    triagem: [],
    execucao: [],
    resolvidas: [],
  };
  for (const d of filtered) byColumn[d.column].push(d);

  return (
    <AppShell
      title="Demandas"
      breadcrumbs={[{ label: "OperaCondo" }, { label: "Demandas" }]}
      actions={
        <>
          <div className="hidden items-center gap-1 rounded-lg border border-[var(--color-outline-variant)] bg-white p-1 md:flex">
            <button
              type="button"
              onClick={() => setView("kanban")}
              aria-pressed={view === "kanban"}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                view === "kanban"
                  ? "bg-[var(--color-navy)] text-white"
                  : "text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
              }`}
            >
              <Icon name="view_kanban" className="text-[16px]" /> Kanban
            </button>
            <button
              type="button"
              onClick={() => setView("lista")}
              aria-pressed={view === "lista"}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                view === "lista"
                  ? "bg-[var(--color-navy)] text-white"
                  : "text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
              }`}
            >
              <Icon name="table_rows" className="text-[16px]" /> Lista
            </button>
          </div>
          <Link
            to="/app/demandas/nova"
            search={{}}
            className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)]"
          >
            <Icon name="add" className="text-[18px]" />
            Nova demanda
          </Link>
        </>
      }
    >
      <FilterBar
        query={query}
        setQuery={setQuery}
        categorias={categorias}
        toggleCategoria={(c) => toggle(categorias, c, setCategorias)}
        prioridades={prioridades}
        togglePrioridade={(p) => toggle(prioridades, p, setPrioridades)}
        colunas={colunas}
        toggleColuna={(c) => toggle(colunas, c, setColunas)}
        temperatura={temperatura}
        setTemperatura={setTemperatura}
        sla={sla}
        setSla={setSla}
        comAnexo={comAnexo}
        setComAnexo={setComAnexo}
        semResponsavel={semResponsavel}
        setSemResponsavel={setSemResponsavel}
        sort={sort}
        setSort={setSort}
        activeCount={activeCount}
        clearAll={clearAll}
        total={DEMANDAS.length}
        visible={filtered.length}
      />

      {filtered.length === 0 ? (
        <EmptyState onClear={clearAll} />
      ) : view === "kanban" ? (
        <KanbanView byColumn={byColumn} />
      ) : (
        <ListaView items={filtered} />
      )}
    </AppShell>
  );
}

/* ---------------- Filter bar ---------------- */

function FilterBar(props: {
  query: string;
  setQuery: (v: string) => void;
  categorias: Set<Category>;
  toggleCategoria: (c: Category) => void;
  prioridades: Set<Priority>;
  togglePrioridade: (p: Priority) => void;
  colunas: Set<ColumnId>;
  toggleColuna: (c: ColumnId) => void;
  temperatura: TempFilter;
  setTemperatura: (t: TempFilter) => void;
  sla: SlaFilter;
  setSla: (s: SlaFilter) => void;
  comAnexo: boolean;
  setComAnexo: (v: boolean) => void;
  semResponsavel: boolean;
  setSemResponsavel: (v: boolean) => void;
  sort: SortKey;
  setSort: (s: SortKey) => void;
  activeCount: number;
  clearAll: () => void;
  total: number;
  visible: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-5 rounded-2xl border border-[var(--color-outline-variant)] bg-white shadow-sm">
      {/* Top row */}
      <div className="flex flex-wrap items-center gap-2 p-3">
        <label className="relative flex min-w-[240px] flex-1 items-center">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 text-[18px] text-[var(--color-on-surface-variant)]"
          />
          <input
            type="search"
            value={props.query}
            onChange={(e) => props.setQuery(e.target.value)}
            placeholder="Buscar por ID, título, morador, unidade ou local…"
            className="h-10 w-full rounded-lg border border-[var(--color-outline-variant)] bg-white pl-10 pr-9 text-sm text-[var(--color-on-surface)] outline-none placeholder:text-[var(--color-on-surface-variant)] focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/25"
          />
          {props.query ? (
            <button
              type="button"
              onClick={() => props.setQuery("")}
              className="absolute right-2 grid h-6 w-6 place-items-center rounded-md text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
              aria-label="Limpar busca"
            >
              <Icon name="close" className="text-[16px]" />
            </button>
          ) : null}
        </label>

        <div className="flex items-center gap-2">
          <label className="hidden items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-2.5 py-1.5 text-xs sm:flex">
            <Icon
              name="sort"
              className="text-[16px] text-[var(--color-on-surface-variant)]"
            />
            <span className="font-semibold text-[var(--color-on-surface-variant)]">
              Ordenar
            </span>
            <select
              value={props.sort}
              onChange={(e) => props.setSort(e.target.value as SortKey)}
              className="bg-transparent text-xs font-semibold text-[var(--color-navy)] outline-none"
            >
              <option value="recentes">Mais recentes</option>
              <option value="antigas">Mais antigas</option>
              <option value="prioridade">Prioridade</option>
              <option value="titulo">Título A–Z</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition ${
              expanded || props.activeCount > 0
                ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                : "border-[var(--color-outline-variant)] bg-white text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
            }`}
          >
            <Icon name="tune" className="text-[16px]" />
            Filtros avançados
            {props.activeCount > 0 ? (
              <span className="rounded-full bg-[var(--color-brand)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                {props.activeCount}
              </span>
            ) : null}
            <Icon
              name={expanded ? "expand_less" : "expand_more"}
              className="text-[16px]"
            />
          </button>

          {props.activeCount > 0 ? (
            <button
              type="button"
              onClick={props.clearAll}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)] hover:text-[var(--color-navy)]"
            >
              <Icon name="close" className="text-[14px]" />
              Limpar
            </button>
          ) : null}
        </div>
      </div>

      {/* Advanced filters */}
      {expanded ? (
        <div className="grid gap-4 border-t border-[var(--color-outline-variant)] p-4 md:grid-cols-2 xl:grid-cols-3">
          <FilterGroup label="Categoria" icon="category">
            {CATEGORIAS.map((c) => (
              <Chip
                key={c}
                active={props.categorias.has(c)}
                onClick={() => props.toggleCategoria(c)}
                icon={CAT_ICON[c]}
              >
                {c}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Prioridade" icon="priority_high">
            {PRIORIDADES.map((p) => (
              <Chip
                key={p}
                active={props.prioridades.has(p)}
                onClick={() => props.togglePrioridade(p)}
                className={props.prioridades.has(p) ? PRIO_CLASS[p] : undefined}
              >
                {p}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Etapa no fluxo" icon="view_kanban">
            {COLUMNS.map((col) => (
              <Chip
                key={col.id}
                active={props.colunas.has(col.id)}
                onClick={() => props.toggleColuna(col.id)}
              >
                <span className={`h-2 w-2 rounded-full ${col.accent}`} />
                {col.title}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Temperatura" icon="local_fire_department">
            <Chip
              active={props.temperatura === "todas"}
              onClick={() => props.setTemperatura("todas")}
            >
              Todas
            </Chip>
            {(Object.keys(TEMP_META) as Array<keyof typeof TEMP_META>).map((t) => (
              <Chip
                key={t}
                active={props.temperatura === t}
                onClick={() => props.setTemperatura(t)}
              >
                <span className={`h-2 w-2 rounded-full ${TEMP_META[t].dot}`} />
                {TEMP_META[t].label}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Prazo (SLA)" icon="schedule">
            <Chip active={props.sla === "todos"} onClick={() => props.setSla("todos")}>
              Todos
            </Chip>
            <Chip active={props.sla === "com"} onClick={() => props.setSla("com")}>
              Com SLA
            </Chip>
            <Chip active={props.sla === "sem"} onClick={() => props.setSla("sem")}>
              Sem SLA
            </Chip>
          </FilterGroup>

          <FilterGroup label="Extras" icon="filter_alt">
            <Chip active={props.comAnexo} onClick={() => props.setComAnexo(!props.comAnexo)}>
              <Icon name="attach_file" className="text-[13px]" /> Com anexo
            </Chip>
            <Chip
              active={props.semResponsavel}
              onClick={() => props.setSemResponsavel(!props.semResponsavel)}
            >
              <Icon name="person_off" className="text-[13px]" /> Sem responsável
            </Chip>
          </FilterGroup>
        </div>
      ) : null}

      {/* Footer counter */}
      <div className="flex items-center justify-between gap-2 border-t border-[var(--color-outline-variant)] bg-[var(--color-surface-mid)]/40 px-4 py-2 text-[11px] text-[var(--color-on-surface-variant)]">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="filter_alt" className="text-[14px]" />
          Exibindo{" "}
          <strong className="text-[var(--color-navy)]">{props.visible}</strong> de{" "}
          {props.total} demandas
        </span>
        {props.activeCount > 0 ? (
          <span className="hidden sm:inline">
            {props.activeCount} filtro{props.activeCount > 1 ? "s" : ""} ativo
            {props.activeCount > 1 ? "s" : ""}
          </span>
        ) : (
          <span className="hidden sm:inline">Atualizado agora</span>
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  icon,
  children,
}: {
  label: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
        <Icon name={icon} className="text-[14px]" />
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  icon,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition";
  const activeCls =
    className ??
    "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]";
  const inactive =
    "border-[var(--color-outline-variant)] bg-white text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${base} ${active ? activeCls : inactive}`}
    >
      {icon ? <Icon name={icon} className="text-[13px]" /> : null}
      {children}
    </button>
  );
}

/* ---------------- Views ---------------- */

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--color-outline-variant)] bg-white p-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-surface-mid)] text-[var(--color-on-surface-variant)]">
        <Icon name="search_off" className="text-[28px]" />
      </div>
      <h3 className="mt-3 text-sm font-bold text-[var(--color-navy)]">
        Nenhuma demanda encontrada
      </h3>
      <p className="mt-1 max-w-sm text-xs text-[var(--color-on-surface-variant)]">
        Ajuste os filtros ou limpe todos para voltar a ver o quadro completo.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-navy)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--color-brand-hover)]"
      >
        <Icon name="restart_alt" className="text-[14px]" />
        Limpar filtros
      </button>
    </div>
  );
}

function KanbanView({ byColumn }: { byColumn: Record<ColumnId, Demanda[]> }) {
  return (
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
                    <Icon name={CAT_ICON[c.category]} className="text-[14px]" />
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
              {cards.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--color-outline-variant)] py-4 text-center text-[11px] text-[var(--color-on-surface-variant)]">
                  Sem demandas nesta etapa.
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListaView({ items }: { items: Demanda[] }) {
  const colOf = (id: ColumnId) => COLUMNS.find((c) => c.id === id)!;
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-outline-variant)] bg-white shadow-sm">
      <div className="hidden grid-cols-[110px_minmax(0,2.2fr)_140px_minmax(0,1.4fr)_120px_minmax(0,1fr)_100px] gap-3 border-b border-[var(--color-outline-variant)] bg-[var(--color-surface-mid)] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-on-surface-variant)] md:grid">
        <span>ID</span>
        <span>Demanda</span>
        <span>Categoria</span>
        <span>Morador · Unidade</span>
        <span>Prioridade</span>
        <span>Status</span>
        <span className="text-right">Idade</span>
      </div>
      <ul className="divide-y divide-[var(--color-outline-variant)]">
        {items.map((c) => {
          const col = colOf(c.column);
          return (
            <li key={c.id}>
              <Link
                to="/app/demandas/$id"
                params={{ id: c.id }}
                preload="intent"
                className="grid grid-cols-1 gap-2 px-4 py-3 transition hover:bg-[var(--color-surface-mid)]/60 md:grid-cols-[110px_minmax(0,2.2fr)_140px_minmax(0,1.4fr)_120px_minmax(0,1fr)_100px] md:items-center md:gap-3"
              >
                <span className="font-mono text-[11px] font-semibold text-[var(--color-on-surface-variant)]">
                  {c.id}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--color-navy)]">
                    {c.title}
                  </p>
                  <p className="truncate text-[11px] text-[var(--color-on-surface-variant)]">
                    {c.location}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--color-on-surface-variant)]">
                  <Icon name={CAT_ICON[c.category]} className="text-[14px]" />
                  {c.category}
                </div>
                <div className="min-w-0 text-xs">
                  <p className="truncate font-semibold text-[var(--color-on-surface)]">
                    {c.morador}
                  </p>
                  <p className="truncate text-[11px] text-[var(--color-on-surface-variant)]">
                    {c.unit}
                  </p>
                </div>
                <span
                  className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PRIO_CLASS[c.priority]}`}
                >
                  {c.priority}
                </span>
                <div className="flex items-center gap-2 text-xs text-[var(--color-on-surface-variant)]">
                  <span className={`h-2 w-2 rounded-full ${col.accent}`} />
                  {col.title}
                </div>
                <span className="text-right text-[11px] text-[var(--color-on-surface-variant)]">
                  {c.age}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
