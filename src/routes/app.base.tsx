import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";

export const Route = createFileRoute("/app/base")({
  head: () => ({
    meta: [{ title: "Base de Conhecimento | Concierge OperaCondo" }],
  }),
  component: BasePage,
});

const COLLECTIONS = [
  { name: "Convenção", icon: "gavel", docs: 1, color: "from-blue-500 to-blue-700", desc: "Documento fundador do condomínio" },
  { name: "Regimento Interno", icon: "rule", docs: 1, color: "from-violet-500 to-violet-700", desc: "Regras de convivência" },
  { name: "Atas de Assembleia", icon: "history_edu", docs: 24, color: "from-emerald-500 to-emerald-700", desc: "Decisões e deliberações" },
  { name: "Procedimentos", icon: "checklist", docs: 18, color: "from-amber-500 to-amber-700", desc: "Fluxos operacionais padrão" },
  { name: "Comunicados", icon: "campaign", docs: 47, color: "from-rose-500 to-rose-700", desc: "Avisos enviados a moradores" },
  { name: "Manuais técnicos", icon: "engineering", docs: 12, color: "from-slate-500 to-slate-700", desc: "Equipamentos e manutenções" },
];

const DOCS = [
  { title: "Convenção atualizada 2024.pdf", coll: "Convenção", size: "2.1 MB", date: "12 fev 2024", status: "treinado" },
  { title: "Ata da AGO de 28/09/2025", coll: "Atas de Assembleia", size: "418 KB", date: "29 set 2025", status: "treinado" },
  { title: "Regimento interno v3.docx", coll: "Regimento Interno", size: "186 KB", date: "08 jan 2025", status: "treinado" },
  { title: "Comunicado — manutenção elevador A", coll: "Comunicados", size: "62 KB", date: "14 nov 2025", status: "processando" },
  { title: "Procedimento de mudança", coll: "Procedimentos", size: "94 KB", date: "02 mar 2025", status: "treinado" },
];

function BasePage() {
  return (
    <AppShell
      title="Base de Conhecimento"
      breadcrumbs={[{ label: "OperaCondo" }, { label: "Base de Conhecimento" }]}
      actions={
        <>
          <button className="btn-press btn-press-active hidden h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)] sm:inline-flex">
            <Icon name="smart_toy" className="text-[18px]" /> Retreinar IA
          </button>
          <button className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)]">
            <Icon name="upload_file" className="text-[18px]" /> Enviar documento
          </button>
        </>
      }
    >
      {/* AI status banner */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[var(--color-navy-deep)] to-[var(--color-brand)] p-6 text-white">
        <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[1fr_auto]">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <Icon name="auto_awesome" className="text-[26px]" filled />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                Voz do Condomínio
              </p>
              <h2 className="text-xl font-bold tracking-tight">
                IA treinada em 103 documentos
              </h2>
              <p className="text-sm text-white/75">
                Última atualização: hoje, 11:42 • próxima execução automática em 6h
              </p>
            </div>
          </div>
          <button className="btn-press btn-press-active inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-navy-deep)] hover:bg-white/90">
            <Icon name="play_circle" className="text-[18px]" /> Testar Concierge
          </button>
        </div>
      </div>

      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
        Coleções
      </h3>
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {COLLECTIONS.map((c) => (
          <button
            key={c.name}
            className="card-elev group rounded-2xl p-4 text-left transition-shadow hover:shadow-md"
          >
            <div
              className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${c.color} text-white`}
            >
              <Icon name={c.icon} className="text-[20px]" filled />
            </div>
            <p className="mt-3 text-sm font-semibold text-[var(--color-navy)]">{c.name}</p>
            <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--color-on-surface-variant)]">
              {c.desc}
            </p>
            <p className="mt-2 text-[11px] font-semibold text-[var(--color-brand)]">
              {c.docs} {c.docs === 1 ? "documento" : "documentos"}
            </p>
          </button>
        ))}
      </section>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
        Documentos recentes
      </h3>
      <div className="card-elev divide-y divide-[var(--color-outline-variant)] overflow-hidden rounded-2xl">
        {DOCS.map((d) => (
          <div
            key={d.title}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 p-4 hover:bg-[var(--color-surface-low)]"
          >
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-surface-mid)] text-[var(--color-navy)]">
              <Icon name="picture_as_pdf" className="text-[22px]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--color-navy)]">
                {d.title}
              </p>
              <p className="text-xs text-[var(--color-on-surface-variant)]">
                {d.coll} • {d.size} • {d.date}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  d.status === "treinado"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    d.status === "treinado" ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                  }`}
                />
                {d.status === "treinado" ? "Treinado" : "Processando"}
              </span>
              <button className="grid h-9 w-9 place-items-center rounded-lg text-[var(--color-on-surface-variant)] hover:bg-white">
                <Icon name="more_horiz" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
