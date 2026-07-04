import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";

export const Route = createFileRoute("/app/moradores")({
  head: () => ({ meta: [{ title: "Moradores | Concierge OperaCondo" }] }),
  component: MoradoresPage,
});

type Status = "Residente" | "Locatário" | "Vago" | "Proprietário";
type CondoTipo = "vertical" | "horizontal";

interface Condominio {
  id: string;
  nome: string;
  tipo: CondoTipo;
  cidade: string;
  unidades: number;
}

interface EnderecoVertical {
  tipo: "vertical";
  bloco: string; // Torre / Bloco
  andar: number;
  apto: string;
}

interface EnderecoHorizontal {
  tipo: "horizontal";
  quadra: string;
  casa: string;
}

type Endereco = EnderecoVertical | EnderecoHorizontal;

interface Morador {
  id: string;
  nome: string;
  condominioId: string;
  endereco: Endereco;
  status: Status;
  vagas: number;
  pets: number;
  contato: string;
  ultimo: string;
}

const STATUS_CLS: Record<Status, string> = {
  Residente: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Locatário: "bg-blue-50 text-blue-700 border-blue-200",
  Vago: "bg-slate-100 text-slate-600 border-slate-200",
  Proprietário: "bg-violet-50 text-violet-700 border-violet-200",
};

const CONDOMINIOS: Condominio[] = [
  {
    id: "aurora",
    nome: "Edifício Aurora",
    tipo: "vertical",
    cidade: "São Paulo — SP",
    unidades: 248,
  },
  {
    id: "parqueverde",
    nome: "Residencial Parque Verde",
    tipo: "horizontal",
    cidade: "Campinas — SP",
    unidades: 96,
  },
  {
    id: "montebello",
    nome: "Edifício Monte Bello",
    tipo: "vertical",
    cidade: "São Paulo — SP",
    unidades: 132,
  },
];

const MORADORES: Morador[] = [
  { id: "m1", nome: "Ana Carvalho", condominioId: "aurora", endereco: { tipo: "vertical", bloco: "Torre A", andar: 12, apto: "1204" }, status: "Residente", vagas: 2, pets: 1, contato: "+55 11 99988-1204", ultimo: "Hoje, 09:14" },
  { id: "m2", nome: "Marcelo Reis", condominioId: "aurora", endereco: { tipo: "vertical", bloco: "Torre A", andar: 8, apto: "802" }, status: "Locatário", vagas: 1, pets: 0, contato: "+55 11 99812-0802", ultimo: "Ontem, 21:02" },
  { id: "m3", nome: "Júlia Tavares", condominioId: "aurora", endereco: { tipo: "vertical", bloco: "Torre B", andar: 5, apto: "506" }, status: "Residente", vagas: 1, pets: 2, contato: "+55 11 98123-0506", ultimo: "Há 2d" },
  { id: "m4", nome: "Bruno Lima", condominioId: "aurora", endereco: { tipo: "vertical", bloco: "Torre B", andar: 22, apto: "Cob. 02" }, status: "Proprietário", vagas: 3, pets: 0, contato: "+55 11 99777-0002", ultimo: "Há 4d" },
  { id: "m5", nome: "Família Mendes", condominioId: "aurora", endereco: { tipo: "vertical", bloco: "Torre A", andar: 4, apto: "401" }, status: "Residente", vagas: 2, pets: 1, contato: "+55 11 98888-0401", ultimo: "Há 1 sem" },
  { id: "m6", nome: "—", condominioId: "aurora", endereco: { tipo: "vertical", bloco: "Torre B", andar: 11, apto: "1101" }, status: "Vago", vagas: 0, pets: 0, contato: "—", ultimo: "—" },

  { id: "m7", nome: "Camila Duarte", condominioId: "parqueverde", endereco: { tipo: "horizontal", quadra: "Q3", casa: "12" }, status: "Residente", vagas: 2, pets: 1, contato: "+55 19 99001-0303", ultimo: "Hoje, 14:22" },
  { id: "m8", nome: "Eduardo Pires", condominioId: "parqueverde", endereco: { tipo: "horizontal", quadra: "Q1", casa: "05" }, status: "Locatário", vagas: 1, pets: 0, contato: "+55 19 98444-0907", ultimo: "Há 3d" },
  { id: "m9", nome: "Renata Sales", condominioId: "parqueverde", endereco: { tipo: "horizontal", quadra: "Q5", casa: "27" }, status: "Proprietário", vagas: 2, pets: 2, contato: "+55 19 97555-2727", ultimo: "Ontem, 08:40" },
  { id: "m10", nome: "Família Oliveira", condominioId: "parqueverde", endereco: { tipo: "horizontal", quadra: "Q2", casa: "18" }, status: "Residente", vagas: 3, pets: 1, contato: "+55 19 96222-1818", ultimo: "Há 6d" },

  { id: "m11", nome: "Sandra Ribeiro", condominioId: "montebello", endereco: { tipo: "vertical", bloco: "Bloco 1", andar: 3, apto: "302" }, status: "Residente", vagas: 1, pets: 0, contato: "+55 11 95111-0302", ultimo: "Hoje, 07:55" },
  { id: "m12", nome: "Pedro Nakamura", condominioId: "montebello", endereco: { tipo: "vertical", bloco: "Bloco 2", andar: 9, apto: "908" }, status: "Locatário", vagas: 1, pets: 1, contato: "+55 11 94222-0908", ultimo: "Há 2 sem" },
];

function formatEndereco(e: Endereco) {
  if (e.tipo === "vertical") {
    return { primary: `Apto ${e.apto}`, secondary: `${e.bloco} • ${e.andar}º andar` };
  }
  return { primary: `Casa ${e.casa}`, secondary: `Quadra ${e.quadra}` };
}

function initials(nome: string) {
  if (nome === "—") return "—";
  return nome
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function MoradoresPage() {
  const [condoId, setCondoId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"Todos" | Status>("Todos");
  const [query, setQuery] = useState("");

  const condoSelecionado = CONDOMINIOS.find((c) => c.id === condoId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MORADORES.filter((m) => {
      if (condoId !== "all" && m.condominioId !== condoId) return false;
      if (statusFilter !== "Todos" && m.status !== statusFilter) return false;
      if (!q) return true;
      const end = formatEndereco(m.endereco);
      return (
        m.nome.toLowerCase().includes(q) ||
        m.contato.toLowerCase().includes(q) ||
        end.primary.toLowerCase().includes(q) ||
        end.secondary.toLowerCase().includes(q)
      );
    });
  }, [condoId, statusFilter, query]);

  const stats = useMemo(() => {
    const pool = condoId === "all" ? MORADORES : MORADORES.filter((m) => m.condominioId === condoId);
    const totalUnidades =
      condoId === "all"
        ? CONDOMINIOS.reduce((s, c) => s + c.unidades, 0)
        : condoSelecionado?.unidades ?? pool.length;
    const ocupadas = pool.filter((m) => m.status !== "Vago").length;
    const pets = pool.reduce((s, m) => s + m.pets, 0);
    const vagas = pool.reduce((s, m) => s + m.vagas, 0);
    return {
      unidades: totalUnidades,
      ocupacao: totalUnidades > 0 ? Math.round((ocupadas / totalUnidades) * 100) : 0,
      pets,
      vagas,
    };
  }, [condoId, condoSelecionado]);

  return (
    <AppShell
      title="Moradores"
      breadcrumbs={[{ label: "OperaCondo" }, { label: "Moradores" }]}
      actions={
        <>
          <button className="btn-press btn-press-active hidden h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)] sm:inline-flex">
            <Icon name="upload" className="text-[18px]" /> Importar CSV
          </button>
          <button className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)]">
            <Icon name="person_add" className="text-[18px]" /> Novo morador
          </button>
        </>
      }
    >
      {/* Seletor de condomínio */}
      <section className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
            Condomínio
          </h3>
          <span className="text-[11px] text-[var(--color-on-surface-variant)]">
            {CONDOMINIOS.length} propriedades sob gestão
          </span>
        </div>
        <div className="custom-scrollbar -mx-2 flex gap-3 overflow-x-auto px-2 pb-1">
          <CondoCard
            active={condoId === "all"}
            onClick={() => setCondoId("all")}
            title="Todos os condomínios"
            subtitle={`${CONDOMINIOS.reduce((s, c) => s + c.unidades, 0)} unidades`}
            icon="apartment"
            badge={`${CONDOMINIOS.length}`}
          />
          {CONDOMINIOS.map((c) => (
            <CondoCard
              key={c.id}
              active={condoId === c.id}
              onClick={() => setCondoId(c.id)}
              title={c.nome}
              subtitle={c.cidade}
              icon={c.tipo === "vertical" ? "domain" : "holiday_village"}
              badge={c.tipo === "vertical" ? "Vertical" : "Horizontal"}
              extra={`${c.unidades} unid.`}
            />
          ))}
        </div>
      </section>

      {/* Summary */}
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Unidades" value={String(stats.unidades)} icon="domain" />
        <StatCard label="Ocupação" value={`${stats.ocupacao}%`} icon="trending_up" />
        <StatCard label="Vagas de garagem" value={String(stats.vagas)} icon="local_parking" />
        <StatCard label="Pets registrados" value={String(stats.pets)} icon="pets" />
      </section>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-outline-variant)] bg-white p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--color-on-surface-variant)]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, unidade, bloco/quadra, telefone…"
            className="w-full rounded-lg border border-[var(--color-outline-variant)] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15"
          />
        </div>
        {(["Todos", "Residente", "Locatário", "Proprietário", "Vago"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setStatusFilter(c)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === c
                ? "bg-[var(--color-navy)] text-white"
                : "bg-[var(--color-surface-mid)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-high)]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card-elev overflow-hidden rounded-2xl">
        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-[var(--color-surface-low)] text-[var(--color-on-surface-variant)]">
              <tr className="text-[11px] uppercase tracking-wider">
                <th className="px-5 py-3 font-semibold">Morador</th>
                <th className="px-5 py-3 font-semibold">Condomínio</th>
                <th className="px-5 py-3 font-semibold">Localização</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Vagas</th>
                <th className="px-5 py-3 font-semibold">Pets</th>
                <th className="px-5 py-3 font-semibold">Última interação</th>
                <th className="px-5 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-outline-variant)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
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
                filtered.map((m) => {
                  const condo = CONDOMINIOS.find((c) => c.id === m.condominioId)!;
                  const end = formatEndereco(m.endereco);
                  return (
                    <tr key={m.id} className="bg-white hover:bg-[var(--color-surface-low)]">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[var(--color-navy)] to-[var(--color-brand)] text-xs font-bold text-white">
                            {initials(m.nome)}
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--color-navy)]">{m.nome}</p>
                            <p className="text-xs text-[var(--color-on-surface-variant)]">{m.contato}</p>
                          </div>
                        </div>
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
                      <td className="px-5 py-3.5 text-[var(--color-on-surface-variant)]">{m.pets}</td>
                      <td className="px-5 py-3.5 text-xs text-[var(--color-on-surface-variant)]">{m.ultimo}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            title="WhatsApp"
                            className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          >
                            <Icon name="chat" className="text-[18px]" />
                          </button>
                          <button
                            title="Detalhes"
                            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
                          >
                            <Icon name="visibility" className="text-[18px]" />
                          </button>
                          <button
                            title="Mais"
                            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
                          >
                            <Icon name="more_horiz" className="text-[18px]" />
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] px-5 py-3 text-xs text-[var(--color-on-surface-variant)]">
          <p>
            Mostrando {filtered.length}{" "}
            {filtered.length === 1 ? "morador" : "moradores"}
            {condoSelecionado ? ` em ${condoSelecionado.nome}` : " (todos os condomínios)"}
          </p>
          <div className="flex items-center gap-1">
            <button className="grid h-8 w-8 place-items-center rounded-md hover:bg-white">
              <Icon name="chevron_left" className="text-[18px]" />
            </button>
            {[1, 2, 3, "…", 12].map((p, i) => (
              <button
                key={i}
                className={`min-w-8 rounded-md px-2 py-1 font-semibold ${
                  p === 1 ? "bg-[var(--color-navy)] text-white" : "hover:bg-white"
                }`}
              >
                {p}
              </button>
            ))}
            <button className="grid h-8 w-8 place-items-center rounded-md hover:bg-white">
              <Icon name="chevron_right" className="text-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function CondoCard({
  active,
  onClick,
  title,
  subtitle,
  icon,
  badge,
  extra,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  icon: string;
  badge: string;
  extra?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex min-w-[240px] shrink-0 items-center gap-3 rounded-2xl border p-3 text-left transition ${
        active
          ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5 shadow-sm"
          : "border-[var(--color-outline-variant)] bg-white hover:border-[var(--color-brand)] hover:bg-[var(--color-surface-low)]"
      }`}
    >
      <div
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
          active
            ? "bg-[var(--color-brand)] text-white"
            : "bg-[var(--color-navy)]/5 text-[var(--color-navy)] group-hover:bg-[var(--color-brand)]/10 group-hover:text-[var(--color-brand)]"
        }`}
      >
        <Icon name={icon} className="text-[22px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--color-navy)]">{title}</p>
        <p className="truncate text-[11px] text-[var(--color-on-surface-variant)]">{subtitle}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
              active
                ? "bg-[var(--color-brand)] text-white"
                : "bg-[var(--color-surface-mid)] text-[var(--color-on-surface-variant)]"
            }`}
          >
            {badge}
          </span>
          {extra ? (
            <span className="text-[10px] text-[var(--color-on-surface-variant)]">{extra}</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="card-elev rounded-xl p-4">
      <div className="flex items-center gap-2 text-[var(--color-on-surface-variant)]">
        <Icon name={icon} className="text-[18px]" />
        <p className="text-xs font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-1.5 text-2xl font-bold text-[var(--color-navy)]">{value}</p>
    </div>
  );
}
