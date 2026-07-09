import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";

export const Route = createFileRoute("/app/base/")({
  head: () => ({
    meta: [{ title: "Base de Conhecimento | Concierge OperaCondo" }],
  }),
  component: BasePage,
});

interface Collection {
  name: string;
  icon: string;
  docs: number;
  color: string;
  desc: string;
}

interface Doc {
  id: string;
  title: string;
  coll: string;
  size: string;
  date: string;
  status: "treinado" | "processando";
}

const COLLECTIONS: Collection[] = [
  { name: "Convenção", icon: "gavel", docs: 1, color: "from-blue-500 to-blue-700", desc: "Documento fundador do condomínio" },
  { name: "Regimento Interno", icon: "rule", docs: 1, color: "from-violet-500 to-violet-700", desc: "Regras de convivência" },
  { name: "Atas de Assembleia", icon: "history_edu", docs: 24, color: "from-emerald-500 to-emerald-700", desc: "Decisões e deliberações" },
  { name: "Procedimentos", icon: "checklist", docs: 18, color: "from-amber-500 to-amber-700", desc: "Fluxos operacionais padrão" },
  { name: "Comunicados", icon: "campaign", docs: 47, color: "from-rose-500 to-rose-700", desc: "Avisos enviados a moradores" },
  { name: "Manuais técnicos", icon: "engineering", docs: 12, color: "from-slate-500 to-slate-700", desc: "Equipamentos e manutenções" },
];

const INITIAL_DOCS: Doc[] = [
  { id: "d1", title: "Convenção atualizada 2024.pdf", coll: "Convenção", size: "2.1 MB", date: "12 fev 2024", status: "treinado" },
  { id: "d2", title: "Ata da AGO de 28/09/2025", coll: "Atas de Assembleia", size: "418 KB", date: "29 set 2025", status: "treinado" },
  { id: "d3", title: "Regimento interno v3.docx", coll: "Regimento Interno", size: "186 KB", date: "08 jan 2025", status: "treinado" },
  { id: "d4", title: "Comunicado — manutenção elevador A", coll: "Comunicados", size: "62 KB", date: "14 nov 2025", status: "processando" },
  { id: "d5", title: "Procedimento de mudança", coll: "Procedimentos", size: "94 KB", date: "02 mar 2025", status: "treinado" },
];

function formatRelative(d: Date) {
  const diff = Math.round((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return "agora mesmo";
  if (diff < 60) return `há ${diff} min`;
  const h = Math.round(diff / 60);
  return `há ${h}h`;
}

function BasePage() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<Doc[]>(INITIAL_DOCS);
  const [filter, setFilter] = useState<string | null>(null);
  const [retraining, setRetraining] = useState(false);
  const [lastTrained, setLastTrained] = useState<Date>(() => new Date(Date.now() - 42 * 60000));
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<Doc | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!openMenu) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openMenu]);

  const filteredDocs = useMemo(
    () => (filter ? docs.filter((d) => d.coll === filter) : docs),
    [docs, filter],
  );

  function runRetrain() {
    if (retraining) return;
    setRetraining(true);
    setDocs((prev) => prev.map((d) => (d.status === "processando" ? { ...d, status: "treinado" } : d)));
    setToast("Retreinamento iniciado — analisando documentos…");
    setTimeout(() => {
      setRetraining(false);
      setLastTrained(new Date());
      setToast("IA retreinada com sucesso em 103 documentos.");
    }, 1800);
  }

  function handleDownload(doc: Doc) {
    const blob = new Blob([`Documento: ${doc.title}\nColeção: ${doc.coll}\nAtualizado em ${doc.date}\n\n(Conteúdo simulado — versão de demonstração)`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.title.replace(/\.[^.]+$/, "") + ".txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToast(`Baixando “${doc.title}”…`);
    setOpenMenu(null);
  }

  function handleRetrainDoc(doc: Doc) {
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: "processando" } : d)));
    setToast(`Reprocessando “${doc.title}”…`);
    setOpenMenu(null);
    setTimeout(() => {
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: "treinado" } : d)));
      setToast(`“${doc.title}” treinado.`);
    }, 1600);
  }

  function handleDelete(doc: Doc) {
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    setToast(`“${doc.title}” removido da base.`);
    setConfirmDel(null);
  }

  return (
    <AppShell
      title="Base de Conhecimento"
      breadcrumbs={[{ label: "OperaCondo" }, { label: "Base de Conhecimento" }]}
      actions={
        <>
          <button
            type="button"
            onClick={runRetrain}
            disabled={retraining}
            className="btn-press btn-press-active hidden h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)] disabled:cursor-wait disabled:opacity-70 sm:inline-flex"
          >
            <Icon name={retraining ? "progress_activity" : "smart_toy"} className={`text-[18px] ${retraining ? "animate-spin" : ""}`} />
            {retraining ? "Retreinando…" : "Retreinar IA"}
          </button>
          <Link
            to="/app/base/enviar"
            className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)]"
          >
            <Icon name="upload_file" className="text-[18px]" /> Enviar documento
          </Link>
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
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Voz do Condomínio</p>
              <h2 className="text-xl font-bold tracking-tight">IA treinada em 103 documentos</h2>
              <p className="text-sm text-white/75">
                Última atualização: {formatRelative(lastTrained)} • próxima execução automática em 6h
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: "/app/agente" })}
            className="btn-press btn-press-active inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-navy-deep)] hover:bg-white/90"
          >
            <Icon name="play_circle" className="text-[18px]" /> Testar Concierge
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">Coleções</h3>
        {filter && (
          <button
            type="button"
            onClick={() => setFilter(null)}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]/80"
          >
            Filtrando: {filter}
            <Icon name="close" className="text-[14px]" />
          </button>
        )}
      </div>
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {COLLECTIONS.map((c) => {
          const active = filter === c.name;
          return (
            <button
              key={c.name}
              type="button"
              onClick={() => setFilter((f) => (f === c.name ? null : c.name))}
              className={`card-elev group rounded-2xl p-4 text-left transition-shadow hover:shadow-md ${active ? "ring-2 ring-[var(--color-brand)]" : ""}`}
            >
              <div className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${c.color} text-white`}>
                <Icon name={c.icon} className="text-[20px]" filled />
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--color-navy)]">{c.name}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--color-on-surface-variant)]">{c.desc}</p>
              <p className="mt-2 text-[11px] font-semibold text-[var(--color-brand)]">
                {c.docs} {c.docs === 1 ? "documento" : "documentos"}
              </p>
            </button>
          );
        })}
      </section>

      <div className="mb-3 mt-8 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
          {filter ? `Documentos • ${filter}` : "Documentos recentes"}
        </h3>
        <span className="text-xs text-[var(--color-on-surface-variant)]">{filteredDocs.length} exibidos</span>
      </div>
      <div className="card-elev divide-y divide-[var(--color-outline-variant)] overflow-hidden rounded-2xl">
        {filteredDocs.length === 0 && (
          <div className="p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
            Nenhum documento nesta coleção ainda.
          </div>
        )}
        {filteredDocs.map((d) => (
          <div key={d.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 p-4 hover:bg-[var(--color-surface-low)]">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-surface-mid)] text-[var(--color-navy)]">
              <Icon name="picture_as_pdf" className="text-[22px]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--color-navy)]">{d.title}</p>
              <p className="text-xs text-[var(--color-on-surface-variant)]">
                {d.coll} • {d.size} • {d.date}
              </p>
            </div>
            <div className="relative flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  d.status === "treinado" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${d.status === "treinado" ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
                {d.status === "treinado" ? "Treinado" : "Processando"}
              </span>
              <button
                type="button"
                onClick={() => setOpenMenu((m) => (m === d.id ? null : d.id))}
                className="grid h-9 w-9 place-items-center rounded-lg text-[var(--color-on-surface-variant)] hover:bg-white"
                aria-label="Ações do documento"
              >
                <Icon name="more_horiz" />
              </button>
              {openMenu === d.id && (
                <div
                  ref={menuRef}
                  className="absolute right-0 top-11 z-20 w-52 overflow-hidden rounded-xl border border-[var(--color-outline-variant)] bg-white shadow-lg"
                >
                  <button
                    type="button"
                    onClick={() => handleDownload(d)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--color-navy)] hover:bg-[var(--color-surface-low)]"
                  >
                    <Icon name="download" className="text-[18px]" /> Baixar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRetrainDoc(d)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--color-navy)] hover:bg-[var(--color-surface-low)]"
                  >
                    <Icon name="smart_toy" className="text-[18px]" /> Retreinar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      setConfirmDel(d);
                    }}
                    className="flex w-full items-center gap-2 border-t border-[var(--color-outline-variant)] px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    <Icon name="delete" className="text-[18px]" /> Remover
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {confirmDel && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setConfirmDel(null)}>
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-600">
                <Icon name="warning" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-[var(--color-navy)]">Remover documento?</h4>
                <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
                  “{confirmDel.title}” será excluído da base e a IA deixará de usá-lo.
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDel(null)}
                className="btn-press btn-press-active h-9 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDel)}
                className="btn-press btn-press-active h-9 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--color-navy)] px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </AppShell>
  );
}
