import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";
import {
  COLECOES,
  STATUS_DOC,
  VISIBILIDADES,
  documentosQuery,
  useDocumentos,
  useDocumentosAcoes,
  type ColecaoId,
  type Documento,
} from "@/data/base";

export const Route = createFileRoute("/app/base/")({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(documentosQuery),
  head: () => ({
    meta: [{ title: "Base de Conhecimento | OperaCondo Concierge" }],
  }),
  component: BasePage,
});

function BasePage() {
  const navigate = useNavigate();
  const docs = useDocumentos();
  const { excluir } = useDocumentosAcoes();
  const [filter, setFilter] = useState<ColecaoId | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<Documento | null>(null);
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
    () => (filter ? docs.filter((d) => d.colecao === filter) : docs),
    [docs, filter],
  );
  const prontos = docs.filter((d) => d.status === "treinado").length;
  const nomeColecao = (id: ColecaoId) => COLECOES.find((c) => c.id === id)?.label ?? id;
  const nomeVisib = (id: string) => VISIBILIDADES.find((v) => v.id === id)?.label ?? id;

  async function handleDelete(doc: Documento) {
    setConfirmDel(null);
    try {
      await excluir(doc.id);
      setToast(`“${doc.titulo}” removido da base.`);
    } catch (err) {
      setToast((err as Error).message);
    }
  }

  return (
    <AppShell
      title="Base de Conhecimento"
      breadcrumbs={[{ label: "OperaCondo" }, { label: "Base de Conhecimento" }]}
      actions={
        <>
          <Link
            to="/app/base/enviar"
            className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow-soft hover:bg-[var(--color-brand-hover)]"
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
              <h2 className="text-xl font-bold tracking-tight">
                {docs.length} {docs.length === 1 ? "documento" : "documentos"} na base
              </h2>
              <p className="text-sm text-white/75">
                {prontos} pronto{prontos === 1 ? "" : "s"} para a IA • {docs.length - prontos}{" "}
                aguardando leitura (a leitura automática chega na próxima fase)
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
            Filtrando: {nomeColecao(filter)}
            <Icon name="close" className="text-[14px]" />
          </button>
        )}
      </div>
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        {COLECOES.map((c) => {
          const active = filter === c.id;
          const n = docs.filter((d) => d.colecao === c.id).length;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter((f) => (f === c.id ? null : c.id))}
              className={`card-elev group rounded-2xl p-4 text-left transition-shadow hover:shadow-card ${active ? "ring-2 ring-[var(--color-brand)]" : ""}`}
            >
              <div className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${c.color} text-white`}>
                <Icon name={c.icon} className="text-[20px]" filled />
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--color-navy)]">{c.label}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--color-on-surface-variant)]">{c.desc}</p>
              <p className="mt-2 text-[11px] font-semibold text-[var(--color-brand)]">
                {n} {n === 1 ? "documento" : "documentos"}
              </p>
            </button>
          );
        })}
      </section>

      <div className="mb-3 mt-8 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
          {filter ? `Documentos • ${nomeColecao(filter)}` : "Documentos recentes"}
        </h3>
        <span className="text-xs text-[var(--color-on-surface-variant)]">{filteredDocs.length} exibidos</span>
      </div>
      <div className="card-elev divide-y divide-[var(--color-outline-variant)] overflow-hidden rounded-2xl">
        {filteredDocs.length === 0 && (
          <div className="p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
            Nenhum documento aqui ainda. Comece pela convenção em “Enviar documento”.
          </div>
        )}
        {filteredDocs.map((d) => (
          <div key={d.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 p-4 hover:bg-[var(--color-surface-low)]">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-surface-mid)] text-[var(--color-navy)]">
              <Icon name="picture_as_pdf" className="text-[22px]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--color-navy)]">{d.titulo}</p>
              <p className="text-xs text-[var(--color-on-surface-variant)]">
                {nomeColecao(d.colecao)} • {d.condominio} • {nomeVisib(d.visibilidade)} • {d.tamanho} •{" "}
                {d.enviadoEm}
                {d.vigenteDesde ? ` • vigente desde ${d.vigenteDesde}` : ""}
              </p>
            </div>
            <div className="relative flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_DOC[d.status].cls}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOC[d.status].dot}`} />
                {STATUS_DOC[d.status].label}
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
                  className="absolute right-0 top-11 z-20 w-52 overflow-hidden rounded-xl border border-[var(--color-outline-variant)] bg-white shadow-elevated"
                >
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpenMenu(null)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--color-navy)] hover:bg-[var(--color-surface-low)]"
                  >
                    <Icon name="download" className="text-[18px]" /> Abrir arquivo
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      setConfirmDel(d);
                    }}
                    className="flex w-full items-center gap-2 border-t border-[var(--color-outline-variant)] px-3 py-2.5 text-left text-sm text-destructive hover:bg-destructive/10"
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
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <Icon name="warning" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-[var(--color-navy)]">Remover documento?</h4>
                <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
                  “{confirmDel.titulo}” será excluído da base, o arquivo será apagado e a IA deixará de usá-lo.
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
                className="btn-press btn-press-active h-9 rounded-lg bg-destructive px-3 text-sm font-semibold text-white hover:bg-destructive/90"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--color-navy)] px-4 py-2 text-sm font-medium text-white shadow-elevated">
          {toast}
        </div>
      )}
    </AppShell>
  );
}
