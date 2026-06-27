import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [{ title: "Dashboard | Concierge OperaCondo" }],
  }),
  component: DashboardPage,
});

const METRICS = [
  {
    label: "Demandas Abertas",
    value: "23",
    delta: "+4 hoje",
    trend: "up",
    icon: "assignment",
    tone: "brand",
  },
  {
    label: "Resolução IA",
    value: "94%",
    delta: "+2.1% vs. semana",
    trend: "up",
    icon: "smart_toy",
    tone: "success",
  },
  {
    label: "SLA Crítico",
    value: "3",
    delta: "Atenção necessária",
    trend: "warn",
    icon: "priority_high",
    tone: "warning",
  },
  {
    label: "Satisfação",
    value: "4.8",
    delta: "★ em 312 avaliações",
    trend: "up",
    icon: "sentiment_very_satisfied",
    tone: "brand",
  },
];

const TONE: Record<string, string> = {
  brand: "bg-[var(--color-info-soft)] text-[var(--color-brand)]",
  success: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
};

const KANBAN_SUMMARY = [
  { col: "Novas", count: 8, color: "bg-[var(--color-brand)]" },
  { col: "Triagem", count: 5, color: "bg-[var(--color-warning)]" },
  { col: "Execução", count: 7, color: "bg-[var(--color-temp-warm)]" },
  { col: "Resolvidas (24h)", count: 14, color: "bg-[var(--color-success)]" },
];

const RECENT = [
  {
    morador: "Ana Carvalho",
    unit: "Apto 1204",
    msg: "Vazamento sob a pia da cozinha. Está pingando bastante.",
    temp: "hot" as const,
    time: "há 4 min",
    avatar: "AC",
  },
  {
    morador: "Marcelo Reis",
    unit: "Apto 802",
    msg: "Posso reservar o salão para sábado às 19h?",
    temp: "cold" as const,
    time: "há 18 min",
    avatar: "MR",
  },
  {
    morador: "Júlia Tavares",
    unit: "Apto 506",
    msg: "Elevador social fazendo barulho ao subir.",
    temp: "warm" as const,
    time: "há 42 min",
    avatar: "JT",
  },
  {
    morador: "Bruno Lima",
    unit: "Cobertura 02",
    msg: "Boleto de outubro já está disponível?",
    temp: "cold" as const,
    time: "há 1h",
    avatar: "BL",
  },
];

const TEMP: Record<"cold" | "warm" | "hot", { label: string; cls: string; dot: string }> = {
  cold: {
    label: "Tranquilo",
    cls: "bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  warm: {
    label: "Atenção",
    cls: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  hot: {
    label: "Urgente",
    cls: "bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
};

function DashboardPage() {
  return (
    <AppShell
      title="Visão geral do condomínio"
      breadcrumbs={[{ label: "OperaCondo" }, { label: "Dashboard" }]}
      actions={
        <>
          <button className="btn-press btn-press-active hidden h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)] sm:inline-flex">
            <Icon name="download" className="text-[18px]" />
            Exportar
          </button>
          <button className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)]">
            <Icon name="add" className="text-[18px]" />
            Nova demanda
          </button>
        </>
      }
    >
      {/* Metrics */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {METRICS.map((m) => (
          <div
            key={m.label}
            className="card-elev rounded-2xl p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                  {m.label}
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-navy)]">
                  {m.value}
                </p>
              </div>
              <div className={`grid h-11 w-11 place-items-center rounded-xl ${TONE[m.tone]}`}>
                <Icon name={m.icon} className="text-[22px]" />
              </div>
            </div>
            <p
              className={`mt-3 inline-flex items-center gap-1 text-xs font-medium ${
                m.trend === "warn" ? "text-[var(--color-warning)]" : "text-[var(--color-success)]"
              }`}
            >
              <Icon
                name={m.trend === "warn" ? "warning" : "trending_up"}
                className="text-[14px]"
              />
              {m.delta}
            </p>
          </div>
        ))}
      </section>

      {/* Kanban summary + Activity */}
      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="card-elev rounded-2xl p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-navy)]">
                Fluxo de Demandas
              </h2>
              <p className="text-xs text-[var(--color-on-surface-variant)]">
                Snapshot do Kanban — últimas 24h
              </p>
            </div>
            <Link
              to="/app/demandas"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-brand)] hover:underline"
            >
              Abrir Kanban
              <Icon name="arrow_forward" className="text-[14px]" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {KANBAN_SUMMARY.map((k) => (
              <div
                key={k.col}
                className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] p-4"
              >
                <span className={`inline-block h-2 w-2 rounded-full ${k.color}`} />
                <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                  {k.col}
                </p>
                <p className="mt-1 text-2xl font-bold text-[var(--color-navy)]">
                  {k.count}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-[var(--color-outline-variant)] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--color-navy)]">
                  Temperatura geral das conversas
                </p>
                <p className="text-xs text-[var(--color-on-surface-variant)]">
                  Análise de sentimento em tempo real
                </p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                Estável
              </span>
            </div>
            <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-mid)]">
              <div className="bg-blue-500" style={{ width: "62%" }} />
              <div className="bg-amber-500" style={{ width: "28%" }} />
              <div className="bg-red-500" style={{ width: "10%" }} />
            </div>
            <div className="mt-3 flex items-center gap-5 text-xs">
              <span className="inline-flex items-center gap-1.5 text-[var(--color-on-surface-variant)]">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Tranquilas 62%
              </span>
              <span className="inline-flex items-center gap-1.5 text-[var(--color-on-surface-variant)]">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Atenção 28%
              </span>
              <span className="inline-flex items-center gap-1.5 text-[var(--color-on-surface-variant)]">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Urgentes 10%
              </span>
            </div>
          </div>
        </div>

        <div className="card-elev rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-navy)]">
                Conversas recentes
              </h2>
              <p className="text-xs text-[var(--color-on-surface-variant)]">
                Acompanhe a IA em ação
              </p>
            </div>
            <Link
              to="/app/agente"
              className="text-xs font-semibold text-[var(--color-brand)] hover:underline"
            >
              Ver todas
            </Link>
          </div>
          <ul className="space-y-3">
            {RECENT.map((r) => (
              <li
                key={r.morador}
                className="group flex gap-3 rounded-xl border border-transparent p-2.5 hover:border-[var(--color-outline-variant)] hover:bg-[var(--color-surface-low)]"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-navy)] text-xs font-bold text-white">
                  {r.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--color-navy)]">
                      {r.morador}
                      <span className="ml-2 text-xs font-normal text-[var(--color-on-surface-variant)]">
                        {r.unit}
                      </span>
                    </p>
                    <span className="shrink-0 text-[10px] text-[var(--color-on-surface-variant)]">
                      {r.time}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-on-surface-variant)]">
                    {r.msg}
                  </p>
                  <span
                    className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TEMP[r.temp].cls}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${TEMP[r.temp].dot}`} />
                    {TEMP[r.temp].label}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Quick links */}
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            title: "Onboarding em andamento",
            desc: "Conclua a configuração do Edifício Aurora — passo 3 de 4.",
            cta: "Continuar setup",
            icon: "rocket_launch",
            to: "/onboarding" as const,
          },
          {
            title: "Base de conhecimento",
            desc: "Adicione a última ata para treinar o Concierge IA.",
            cta: "Abrir biblioteca",
            icon: "menu_book",
            to: "/app/base" as const,
          },
          {
            title: "Fornecedores",
            desc: "2 prestadores aguardando homologação.",
            cta: "Revisar agora",
            icon: "inventory_2",
            to: "/app/fornecedores" as const,
          },
        ].map((c) => (
          <Link
            key={c.title}
            to={c.to}
            className="card-elev group rounded-2xl p-5 transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
                <Icon name={c.icon} />
              </div>
              <Icon
                name="arrow_outward"
                className="text-[18px] text-[var(--color-on-surface-variant)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--color-brand)]"
              />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-[var(--color-navy)]">
              {c.title}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-on-surface-variant)]">
              {c.desc}
            </p>
            <p className="mt-3 text-xs font-semibold text-[var(--color-brand)]">
              {c.cta} →
            </p>
          </Link>
        ))}
      </section>
    </AppShell>
  );
}
