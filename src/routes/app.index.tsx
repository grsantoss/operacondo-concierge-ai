import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";
import { COLUMNS, demandasQuery, useDemandas, type Demanda, type Priority } from "@/data/demandas";
import { URGENCIA } from "@/lib/urgencia";

export const Route = createFileRoute("/app/")({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(demandasQuery),
  head: () => ({
    meta: [{ title: "Dashboard | OperaCondo Concierge" }],
  }),
  component: DashboardPage,
});

const TONE: Record<string, string> = {
  brand: "bg-[var(--color-info-soft)] text-[var(--color-brand)]",
  success: "bg-[var(--color-success-soft)] text-[var(--color-success-strong)]",
  warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning-strong)]",
  danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
};

// ponytail: conversas de exemplo até o WhatsApp (Fase 2); depois vêm de `conversas`.
const RECENT: { morador: string; unit: string; msg: string; prioridade: Priority; time: string; avatar: string }[] = [
  {
    morador: "Ana Carvalho",
    unit: "Apto 1204",
    msg: "Vazamento sob a pia da cozinha. Está pingando bastante.",
    prioridade: "Crítica",
    time: "há 4 min",
    avatar: "AC",
  },
  {
    morador: "Marcelo Reis",
    unit: "Apto 802",
    msg: "Posso reservar o salão para sábado às 19h?",
    prioridade: "Normal",
    time: "há 18 min",
    avatar: "MR",
  },
  {
    morador: "Júlia Tavares",
    unit: "Apto 506",
    msg: "Elevador social fazendo barulho ao subir.",
    prioridade: "Alta",
    time: "há 42 min",
    avatar: "JT",
  },
];

const PRIORIDADES: Priority[] = ["Crítica", "Alta", "Normal"];

/** Números do painel, calculados das demandas do banco. */
function resumo(demandas: Demanda[]) {
  const abertas = demandas.filter((d) => d.column !== "resolvidas");
  const porColuna = (c: string) => demandas.filter((d) => d.column === c).length;
  const porPrioridade = Object.fromEntries(
    PRIORIDADES.map((p) => [p, abertas.filter((d) => d.priority === p).length]),
  ) as Record<Priority, number>;
  return {
    metricas: [
      { label: "Demandas abertas", value: abertas.length, icon: "assignment", tone: "brand" },
      {
        label: "Críticas abertas",
        value: porPrioridade["Crítica"],
        icon: "priority_high",
        tone: porPrioridade["Crítica"] > 0 ? "danger" : "success",
      },
      { label: "Em execução", value: porColuna("execucao"), icon: "build", tone: "warning" },
      { label: "Resolvidas", value: porColuna("resolvidas"), icon: "task_alt", tone: "success" },
    ],
    kanban: COLUMNS.map((c) => ({ col: c.title, count: porColuna(c.id), color: c.accent })),
    porPrioridade,
    abertas: abertas.length,
  };
}

function csvEscape(v: string | number) {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportDashboardCsv(r: ReturnType<typeof resumo>) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const lines: string[] = [];
  lines.push("OperaCondo Concierge — Visão geral do condomínio");
  lines.push(`Gerado em;${new Date().toLocaleString("pt-BR")}`);
  lines.push("");
  lines.push(["Indicador", "Valor"].map(csvEscape).join(";"));
  for (const m of r.metricas) lines.push([m.label, m.value].map(csvEscape).join(";"));
  lines.push("");
  lines.push("Demandas por coluna");
  lines.push(["Coluna", "Quantidade"].map(csvEscape).join(";"));
  for (const k of r.kanban) lines.push([k.col, k.count].map(csvEscape).join(";"));
  lines.push("");
  lines.push("Urgência das demandas abertas");
  lines.push(["Urgência", "Quantidade"].map(csvEscape).join(";"));
  for (const p of PRIORIDADES) lines.push([p, r.porPrioridade[p]].map(csvEscape).join(";"));

  const csv = "\uFEFF" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dashboard-operacondo-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function DashboardPage() {
  const r = resumo(useDemandas());
  return (
    <AppShell
      title="Visão geral do condomínio"
      breadcrumbs={[{ label: "OperaCondo" }, { label: "Dashboard" }]}
      actions={
        <button
          type="button"
          onClick={() => exportDashboardCsv(r)}
          className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)]"
        >
          <Icon name="download" className="text-[18px]" />
          Exportar
        </button>
      }
    >
      {/* Metrics */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {r.metricas.map((m) => (
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
                Demandas por coluna do Kanban
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
            {r.kanban.map((k) => (
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
            <p className="text-sm font-semibold text-[var(--color-navy)]">Urgência das demandas abertas</p>
            <p className="text-xs text-[var(--color-on-surface-variant)]">
              {r.abertas} {r.abertas === 1 ? "demanda aberta" : "demandas abertas"}
            </p>
            <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-mid)]">
              {PRIORIDADES.map((p) =>
                r.porPrioridade[p] ? (
                  <div
                    key={p}
                    className={URGENCIA[p].dot}
                    style={{ width: `${(r.porPrioridade[p] / r.abertas) * 100}%` }}
                  />
                ) : null,
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
              {PRIORIDADES.map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5 text-[var(--color-on-surface-variant)]">
                  <span className={`h-2 w-2 rounded-full ${URGENCIA[p].dot}`} />
                  {p} {r.porPrioridade[p]}
                </span>
              ))}
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
                Exemplo — as conversas reais chegam com o WhatsApp
              </p>
            </div>
            <Link
              to="/app/agente"
              className="shrink-0 whitespace-nowrap text-xs font-semibold text-[var(--color-brand)] hover:underline"
            >
              Ver todas
            </Link>
          </div>
          <ul className="space-y-3">
            {RECENT.map((c) => (
              <li
                key={c.morador}
                className="group flex gap-3 rounded-xl border border-transparent p-2.5 hover:border-[var(--color-outline-variant)] hover:bg-[var(--color-surface-low)]"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-navy)] text-xs font-bold text-white">
                  {c.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--color-navy)]">
                      {c.morador}
                      <span className="ml-2 text-xs font-normal text-[var(--color-on-surface-variant)]">
                        {c.unit}
                      </span>
                    </p>
                    <span className="shrink-0 text-[10px] text-[var(--color-on-surface-variant)]">
                      {c.time}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-on-surface-variant)]">
                    {c.msg}
                  </p>
                  <span
                    className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${URGENCIA[c.prioridade].bg} ${URGENCIA[c.prioridade].text}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${URGENCIA[c.prioridade].dot}`} />
                    {c.prioridade}
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
            className="card-elev group rounded-2xl p-5 transition-shadow hover:shadow-card"
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
