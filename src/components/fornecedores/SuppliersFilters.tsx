import { Icon } from "@/components/brand/Icon";
import type { Estado } from "@/data/fornecedores";

export type SortKey = "nome" | "rating" | "servicos" | "estado";
export type RatingMin = 0 | 4 | 4.5 | 4.8;

export interface FiltersState {
  q: string;
  estados: Estado[];
  categoria: string;
  ratingMin: RatingMin;
  apenasRecentes: boolean;
  sort: SortKey;
}

export const INITIAL_FILTERS: FiltersState = {
  q: "",
  estados: [],
  categoria: "all",
  ratingMin: 0,
  apenasRecentes: false,
  sort: "nome",
};

const ESTADOS: Estado[] = ["Homologado", "Em análise", "Renovação", "Inativo"];

interface Props {
  filters: FiltersState;
  onChange: (patch: Partial<FiltersState>) => void;
  onReset: () => void;
  counts: Record<Estado, number>;
  categorias: string[];
  hasActive: boolean;
}

export function SuppliersFilters({ filters, onChange, onReset, counts, categorias, hasActive }: Props) {
  return (
    <div className="mb-4 rounded-xl border border-[var(--color-outline-variant)] bg-white p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--color-on-surface-variant)]"
          />
          <input
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Buscar por nome, CNPJ, categoria, contato…"
            className="w-full rounded-lg border border-[var(--color-outline-variant)] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15"
          />
        </div>

        <SelectPill
          icon="category"
          label="Categoria"
          value={filters.categoria}
          onChange={(v) => onChange({ categoria: v })}
          options={[{ v: "all", l: "Todas" }, ...categorias.map((c) => ({ v: c, l: c }))]}
        />

        <SelectPill
          icon="star"
          label="Rating"
          value={String(filters.ratingMin)}
          onChange={(v) => onChange({ ratingMin: Number(v) as RatingMin })}
          options={[
            { v: "0", l: "Todos" },
            { v: "4", l: "≥ 4.0" },
            { v: "4.5", l: "≥ 4.5" },
            { v: "4.8", l: "≥ 4.8" },
          ]}
        />

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-navy)]">
          <input
            type="checkbox"
            checked={filters.apenasRecentes}
            onChange={(e) => onChange({ apenasRecentes: e.target.checked })}
          />
          Com serviços recentes
        </label>

        <SelectPill
          icon="sort"
          label="Ordenar"
          value={filters.sort}
          onChange={(v) => onChange({ sort: v as SortKey })}
          options={[
            { v: "nome", l: "Nome A→Z" },
            { v: "rating", l: "Melhor rating" },
            { v: "servicos", l: "Mais serviços" },
            { v: "estado", l: "Estado" },
          ]}
        />

        {hasActive && (
          <button
            onClick={onReset}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-xs font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
          >
            <Icon name="close" className="text-[14px]" /> Limpar filtros
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {ESTADOS.map((e) => {
          const active = filters.estados.includes(e);
          return (
            <button
              key={e}
              onClick={() =>
                onChange({
                  estados: active
                    ? filters.estados.filter((x) => x !== e)
                    : [...filters.estados, e],
                })
              }
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-[var(--color-navy)] text-white"
                  : "bg-[var(--color-surface-mid)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-high)]"
              }`}
            >
              {e}
              <span
                className={`rounded-full px-1.5 text-[10px] ${
                  active ? "bg-white/20" : "bg-white/70 text-[var(--color-on-surface-variant)]"
                }`}
              >
                {counts[e]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SelectPill({
  icon,
  label,
  value,
  onChange,
  options,
}: {
  icon: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 py-2 text-sm">
      <Icon name={icon} className="text-[16px] text-[var(--color-brand)]" />
      <span className="text-xs font-semibold text-[var(--color-on-surface-variant)]">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm font-semibold text-[var(--color-navy)] outline-none"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
    </label>
  );
}
