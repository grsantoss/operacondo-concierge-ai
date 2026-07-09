import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";
import { ImportCsvModal } from "@/components/moradores/ImportCsvModal";
import { NewMoradorModal } from "@/components/moradores/NewMoradorModal";
import {
  CONDOMINIOS,
  STATUS_CLS,
  STATUS_LIST,
  formatEndereco,
  initials,
  useMoradores,
  whatsappUrl,
  type Morador,
  type Status,
} from "@/data/moradores";

export const Route = createFileRoute("/app/moradores/")({
  head: () => ({ meta: [{ title: "Moradores | Concierge OperaCondo" }] }),
  component: MoradoresPage,
});

type StatusFilter = "Todos" | Status;

function MoradoresPage() {
  const moradores = useMoradores();
  const arquivadosCount = useMoradores({ includeInactive: true }).filter(
    (m) => m.status === "Inativo",
  ).length;
  const [condoId, setCondoId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Todos");
  const [query, setQuery] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const condoSelecionado = CONDOMINIOS.find((c) => c.id === condoId);

  const pool = useMemo(
    () => (condoId === "all" ? moradores : moradores.filter((m) => m.condominioId === condoId)),
    [moradores, condoId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter((m) => {
      if (statusFilter !== "Todos" && m.status !== statusFilter) return false;
      if (!q) return true;
      const end = formatEndereco(m.endereco);
      return (
        m.nome.toLowerCase().includes(q) ||
        m.contato.toLowerCase().includes(q) ||
        end.primary.toLowerCase().includes(q) ||
        end.secondary.toLowerCase().includes(q) ||
        (m.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [pool, statusFilter, query]);

  const stats = useMemo(() => {
    const totalUnidades =
      condoId === "all"
        ? CONDOMINIOS.reduce((s, c) => s + c.unidades, 0)
        : condoSelecionado?.unidades ?? pool.length;
    const ocupadas = pool.filter((m) => m.status !== "Vago").length;
    const vagas = pool.filter((m) => m.status === "Vago").length;
    const ativos = pool.filter((m) =>
      ["Residente", "Locatário", "Proprietário"].includes(m.status),
    ).length;
    const novos = pool.filter((m) => (m.desde ?? "").match(/2026|2025/)).length;
    return {
      unidades: totalUnidades,
      ocupacao: totalUnidades > 0 ? Math.round((ocupadas / totalUnidades) * 100) : 0,
      ocupadas,
      vagas,
      ativos,
      novos,
    };
  }, [pool, condoId, condoSelecionado]);

  const activeFilters = (statusFilter !== "Todos" ? 1 : 0) + (query.trim() ? 1 : 0);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }

  return (
    <AppShell
      title="Moradores"
      breadcrumbs={[{ label: "OperaCondo" }, { label: "Moradores" }]}
      actions={
        <>
          <Link
            to="/app/moradores/arquivados"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
          >
            <Icon name="inventory_2" className="text-[18px]" /> Arquivados
            <span className="rounded-full bg-[var(--color-surface-mid)] px-1.5 text-[10px] font-bold text-[var(--color-on-surface-variant)]">
              {arquivadosCount}
            </span>
          </Link>
          <button
            onClick={() => setShowImport(true)}
            className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)]"
          >
            <Icon name="upload" className="text-[18px]" /> Importar CSV
          </button>
          <button className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)]">
            <Icon name="person_add" className="text-[18px]" /> Novo morador
          </button>
        </>
      }
    >
      {/* Dashboard */}
      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Unidades"
          value={String(stats.unidades)}
          icon="domain"
          hint={`${stats.ocupadas} ocupadas · ${stats.vagas} vagas`}
          onClick={() => setStatusFilter("Todos")}
        />
        <KpiCard
          label="Ocupação"
          value={`${stats.ocupacao}%`}
          icon="trending_up"
          hint="Taxa atual"
          tone="brand"
        />
        <KpiCard
          label="Moradores ativos"
          value={String(stats.ativos)}
          icon="groups"
          hint="Residentes + locatários + proprietários"
          tone="success"
        />
        <KpiCard
          label="Unidades vagas"
          value={String(stats.vagas)}
          icon="meeting_room"
          hint="Clique para filtrar"
          tone="warn"
          onClick={() => setStatusFilter("Vago")}
        />
        <KpiCard
          label="Novos moradores"
          value={String(stats.novos)}
          icon="how_to_reg"
          hint="Nos últimos 12 meses"
        />
      </section>

      {/* Filters bar */}
      <div className="mb-4 rounded-xl border border-[var(--color-outline-variant)] bg-white p-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Condo dropdown */}
          <label className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 py-2 text-sm">
            <Icon name="apartment" className="text-[18px] text-[var(--color-brand)]" />
            <span className="text-xs font-semibold text-[var(--color-on-surface-variant)]">
              Condomínio:
            </span>
            <select
              value={condoId}
              onChange={(e) => setCondoId(e.target.value)}
              className="bg-transparent text-sm font-semibold text-[var(--color-navy)] outline-none"
            >
              <option value="all">Todos ({moradores.length})</option>
              {CONDOMINIOS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({moradores.filter((m) => m.condominioId === c.id).length})
                </option>
              ))}
            </select>
          </label>

          {/* Search */}
          <div className="relative min-w-[240px] flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--color-on-surface-variant)]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, unidade, e-mail, telefone…"
              className="w-full rounded-lg border border-[var(--color-outline-variant)] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15"
            />
          </div>

          {activeFilters > 0 && (
            <button
              onClick={() => {
                setStatusFilter("Todos");
                setQuery("");
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-xs font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
            >
              <Icon name="close" className="text-[14px]" /> Limpar
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {(["Todos", ...STATUS_LIST] as StatusFilter[]).map((s) => {
            const count =
              s === "Todos" ? pool.length : pool.filter((m) => m.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === s
                    ? "bg-[var(--color-navy)] text-white"
                    : "bg-[var(--color-surface-mid)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-high)]"
                }`}
              >
                {s}
                <span
                  className={`rounded-full px-1.5 text-[10px] ${
                    statusFilter === s
                      ? "bg-white/20"
                      : "bg-white/70 text-[var(--color-on-surface-variant)]"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="card-elev overflow-hidden rounded-2xl">
        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-[var(--color-surface-low)] text-[var(--color-on-surface-variant)]">
              <tr className="text-[11px] uppercase tracking-wider">
                <th className="px-5 py-3 font-semibold">Morador</th>
                <th className="px-5 py-3 font-semibold">Condomínio</th>
                <th className="px-5 py-3 font-semibold">Localização</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Vagas</th>
                
                <th className="px-5 py-3 font-semibold">Última interação</th>
                <th className="px-5 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-outline-variant)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--color-surface-mid)] text-[var(--color-on-surface-variant)]">
                      <Icon name="search_off" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[var(--color-navy)]">
                      Nenhum morador encontrado
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
                      Ajuste os filtros ou a busca para tentar novamente.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <MoradorRow key={m.id} m={m} />
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] px-5 py-3 text-xs text-[var(--color-on-surface-variant)]">
          <p>
            Mostrando {filtered.length} de {pool.length}{" "}
            {pool.length === 1 ? "morador" : "moradores"}
            {condoSelecionado ? ` em ${condoSelecionado.nome}` : " (todos os condomínios)"}
          </p>
        </div>
      </div>

      <ImportCsvModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={(n) => flash(`${n} morador(es) importado(s) com sucesso.`)}
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

function MoradorRow({ m }: { m: Morador }) {
  const condo = CONDOMINIOS.find((c) => c.id === m.condominioId)!;
  const end = formatEndereco(m.endereco);
  const isVago = m.status === "Vago";
  return (
    <tr className="bg-white hover:bg-[var(--color-surface-low)]">
      <td className="px-5 py-3.5">
        <Link
          to="/app/moradores/$id"
          params={{ id: m.id }}
          preload="intent"
          className="group flex items-center gap-3"
        >
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[var(--color-navy)] to-[var(--color-brand)] text-xs font-bold text-white">
            {initials(m.nome)}
          </div>
          <div>
            <p className="font-semibold text-[var(--color-navy)] group-hover:text-[var(--color-brand)]">
              {m.nome}
            </p>
            <p className="text-xs text-[var(--color-on-surface-variant)]">{m.contato}</p>
          </div>
        </Link>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div
            className={`grid h-8 w-8 place-items-center rounded-lg ${
              condo.tipo === "vertical"
                ? "bg-blue-50 text-blue-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            <Icon
              name={condo.tipo === "vertical" ? "domain" : "holiday_village"}
              className="text-[16px]"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-[var(--color-navy)]">
              {condo.nome}
            </p>
            <p className="truncate text-[10px] text-[var(--color-on-surface-variant)]">
              {condo.cidade}
            </p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <div className="inline-flex items-center gap-2">
          <Icon
            name={m.endereco.tipo === "vertical" ? "apartment" : "house"}
            className="text-[16px] text-[var(--color-on-surface-variant)]"
          />
          <div>
            <p className="font-mono text-sm font-semibold text-[var(--color-navy)]">
              {end.primary}
            </p>
            <p className="text-[11px] text-[var(--color-on-surface-variant)]">
              {end.secondary}
            </p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLS[m.status]}`}
        >
          {m.status}
        </span>
      </td>
      <td className="px-5 py-3.5 text-[var(--color-on-surface-variant)]">{m.vagas}</td>
      
      <td className="px-5 py-3.5 text-xs text-[var(--color-on-surface-variant)]">
        {m.ultimo}
      </td>
      <td className="px-5 py-3.5 text-right">
        <div className="inline-flex items-center gap-1">
          {!isVago && (
            <a
              href={whatsappUrl(
                m.contato,
                `Olá, ${m.nome.split(" ")[0]}! Aqui é da administração.`,
              )}
              target="_blank"
              rel="noreferrer"
              title="Abrir no WhatsApp"
              aria-label={`Enviar WhatsApp para ${m.nome}`}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <Icon name="chat" className="text-[14px]" /> WhatsApp
            </a>
          )}
          <Link
            to="/app/moradores/$id"
            params={{ id: m.id }}
            preload="intent"
            title="Ver detalhes"
            aria-label={`Ver detalhes de ${m.nome}`}
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)] hover:text-[var(--color-brand)]"
          >
            <Icon name="visibility" className="text-[18px]" />
          </Link>
        </div>
      </td>
    </tr>
  );
}

function KpiCard({
  label,
  value,
  icon,
  hint,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  icon: string;
  hint?: string;
  tone?: "brand" | "warn" | "success";
  onClick?: () => void;
}) {
  const toneCls =
    tone === "brand"
      ? "bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
      : tone === "warn"
        ? "bg-amber-50 text-amber-700"
        : tone === "success"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-[var(--color-navy)]/5 text-[var(--color-navy)]";
  const clickable = onClick
    ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md"
    : "";
  return (
    <div
      role={onClick ? "button" : undefined}
      onClick={onClick}
      className={`card-elev rounded-xl p-4 ${clickable}`}
    >
      <div className={`inline-grid h-8 w-8 place-items-center rounded-lg ${toneCls}`}>
        <Icon name={icon} className="text-[16px]" />
      </div>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
        {label}
      </p>
      <p className="text-2xl font-bold text-[var(--color-navy)]">{value}</p>
      {hint && (
        <p className="mt-0.5 text-[10px] text-[var(--color-on-surface-variant)]">{hint}</p>
      )}
    </div>
  );
}
