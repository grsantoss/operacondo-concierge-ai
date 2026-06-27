import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";

export const Route = createFileRoute("/app/demandas")({
  head: () => ({ meta: [{ title: "Demandas | Concierge OperaCondo" }] }),
  component: DemandasPage,
});

type Priority = "Crítica" | "Alta" | "Normal";
type Category = "Manutenção" | "Segurança" | "Limpeza" | "Administrativo";

interface Card {
  id: string;
  title: string;
  morador: string;
  unit: string;
  priority: Priority;
  category: Category;
  age: string;
  sla?: string;
  assigned?: string;
}

const PRIO: Record<Priority, string> = {
  Crítica: "bg-red-50 text-red-700 border-red-200",
  Alta: "bg-amber-50 text-amber-700 border-amber-200",
  Normal: "bg-slate-100 text-slate-700 border-slate-200",
};
const CAT_ICON: Record<Category, string> = {
  Manutenção: "build",
  Segurança: "shield",
  Limpeza: "cleaning_services",
  Administrativo: "description",
};

const COLUMNS: { id: string; title: string; accent: string; cards: Card[] }[] = [
  {
    id: "novas",
    title: "Novas",
    accent: "bg-[var(--color-brand)]",
    cards: [
      {
        id: "D-2401",
        title: "Vazamento sob a pia da cozinha",
        morador: "Ana Carvalho",
        unit: "Apto 1204",
        priority: "Crítica",
        category: "Manutenção",
        age: "há 4 min",
        sla: "SLA 2h",
      },
      {
        id: "D-2400",
        title: "Câmera do hall do 5º andar offline",
        morador: "Equipe Portaria",
        unit: "Áreas comuns",
        priority: "Alta",
        category: "Segurança",
        age: "há 22 min",
        sla: "SLA 6h",
      },
      {
        id: "D-2399",
        title: "Reserva do salão de festas — sábado 19h",
        morador: "Marcelo Reis",
        unit: "Apto 802",
        priority: "Normal",
        category: "Administrativo",
        age: "há 38 min",
      },
    ],
  },
  {
    id: "triagem",
    title: "Triagem",
    accent: "bg-[var(--color-warning)]",
    cards: [
      {
        id: "D-2395",
        title: "Elevador social com ruído ao subir",
        morador: "Júlia Tavares",
        unit: "Apto 506",
        priority: "Alta",
        category: "Manutenção",
        age: "há 1h",
        sla: "SLA 8h",
        assigned: "Roberto S.",
      },
      {
        id: "D-2392",
        title: "Cheiro forte no corredor do 3º andar",
        morador: "Diversos",
        unit: "Áreas comuns",
        priority: "Normal",
        category: "Limpeza",
        age: "há 2h",
        assigned: "Carla M.",
      },
    ],
  },
  {
    id: "execucao",
    title: "Em execução",
    accent: "bg-[var(--color-temp-warm)]",
    cards: [
      {
        id: "D-2380",
        title: "Troca de lâmpadas — garagem nível -2",
        morador: "Manutenção",
        unit: "Garagem",
        priority: "Normal",
        category: "Manutenção",
        age: "há 5h",
        assigned: "ElétricaPro",
      },
      {
        id: "D-2378",
        title: "Manutenção preventiva piscina",
        morador: "Equipe Operação",
        unit: "Lazer",
        priority: "Normal",
        category: "Manutenção",
        age: "há 1d",
        assigned: "AquaService",
      },
      {
        id: "D-2370",
        title: "Reforço de ronda — fim de semana",
        morador: "Conselho",
        unit: "Geral",
        priority: "Alta",
        category: "Segurança",
        age: "há 1d",
        assigned: "Guarda24",
      },
    ],
  },
  {
    id: "resolvidas",
    title: "Resolvidas",
    accent: "bg-[var(--color-success)]",
    cards: [
      {
        id: "D-2365",
        title: "Boleto duplicado — outubro",
        morador: "Bruno Lima",
        unit: "Cobertura 02",
        priority: "Normal",
        category: "Administrativo",
        age: "ontem",
      },
      {
        id: "D-2362",
        title: "Portão da garagem travado",
        morador: "Portaria",
        unit: "Garagem",
        priority: "Crítica",
        category: "Manutenção",
        age: "ontem",
      },
    ],
  },
];

function DemandasPage() {
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
      {/* Filters bar */}
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
          <Icon name="filter_alt" className="text-[16px]" /> 23 demandas •
          atualizado agora
        </div>
      </div>

      {/* Kanban */}
      <div className="custom-scrollbar -mx-2 flex gap-4 overflow-x-auto px-2 pb-4">
        {COLUMNS.map((col) => (
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
                  {col.cards.length}
                </span>
              </div>
              <button className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-navy)]">
                <Icon name="more_horiz" className="text-[18px]" />
              </button>
            </header>
            <div className="flex flex-col gap-3 px-3 pb-3">
              {col.cards.map((c) => (
                <article
                  key={c.id}
                  className="cursor-pointer rounded-xl border border-[var(--color-outline-variant)] bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-semibold text-[var(--color-on-surface-variant)]">
                      {c.id}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PRIO[c.priority]}`}
                    >
                      {c.priority}
                    </span>
                  </div>
                  <h4 className="mt-2 text-sm font-semibold leading-snug text-[var(--color-navy)]">
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
                </article>
              ))}
              <button className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-outline-variant)] py-2.5 text-xs font-semibold text-[var(--color-on-surface-variant)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]">
                <Icon name="add" className="text-[16px]" /> Adicionar
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
