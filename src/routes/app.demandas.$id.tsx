import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";
import {
  CAT_ICON,
  COLUMNS,
  PRIO_CLASS,
  addAnexos,
  addMensagem,
  assumirConversa,
  getAdjacent,
  getDemanda,
  getRelatedDemandas,
  resolveDemanda,
  type Demanda,
  type Message,
  type TimelineEvent,
} from "@/data/demandas";

export const Route = createFileRoute("/app/demandas/$id")({
  loader: ({ params }) => {
    const demanda = getDemanda(params.id);
    if (!demanda) throw notFound();
    return {
      demanda,
      related: getRelatedDemandas(params.id),
      adjacent: getAdjacent(params.id),
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.demanda.id} • ${loaderData.demanda.title} | Demandas`
          : "Demanda não encontrada",
      },
    ],
  }),
  errorComponent: DemandaError,
  notFoundComponent: DemandaNotFound,
  component: DemandaDetail,
});

const TEMP_STYLE = {
  cold: {
    label: "Fria",
    class: "bg-blue-50 text-[var(--color-temp-cold)] border-blue-200",
    dot: "bg-[var(--color-temp-cold)]",
  },
  warm: {
    label: "Morna",
    class: "bg-amber-50 text-[var(--color-temp-warm)] border-amber-200",
    dot: "bg-[var(--color-temp-warm)]",
  },
  hot: {
    label: "Quente",
    class: "bg-red-50 text-[var(--color-temp-hot)] border-red-200",
    dot: "bg-[var(--color-temp-hot)]",
  },
} as const;

const ATTACH_ICON = {
  image: "image",
  pdf: "picture_as_pdf",
  video: "movie",
} as const;

function DemandaDetail() {
  const { demanda, related, adjacent } = Route.useLoaderData() as {
    demanda: Demanda;
    related: Demanda[];
    adjacent: { prev?: Demanda; next?: Demanda };
  };
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const columnMeta = COLUMNS.find((c) => c.id === demanda.column)!;
  const temp = TEMP_STYLE[demanda.temperature];
  const isResolved = demanda.column === "resolvidas";
  const assumed = Boolean(demanda.assumedBy);

  const whatsappUrl = buildWhatsappUrl(demanda);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  function handleResolve() {
    if (isResolved) return;
    resolveDemanda(demanda.id);
    showToast("Demanda marcada como resolvida");
    router.invalidate();
  }

  function handleAssumir() {
    if (assumed) return;
    assumirConversa(demanda.id, "Você");
    showToast("Você assumiu a conversa");
    router.invalidate();
  }

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    addMensagem(demanda.id, { from: "sindico", author: "Você", text });
    setDraft("");
    router.invalidate();
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function handlePickFiles() {
    fileInputRef.current?.click();
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    addAnexos(demanda.id, files);
    showToast(`${files.length} ${files.length === 1 ? "anexo adicionado" : "anexos adicionados"}`);
    router.invalidate();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <AppShell
      title={demanda.title}
      breadcrumbs={[
        { label: "OperaCondo" },
        { label: "Demandas", to: "/app/demandas" },
        { label: demanda.id },
      ]}
      actions={
        <>
          <Link
            to="/app/demandas"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
          >
            <Icon name="arrow_back" className="text-[18px]" /> Voltar ao Kanban
          </Link>
          <button
            type="button"
            onClick={handleResolve}
            disabled={isResolved}
            className={`btn-press inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-sm ${
              isResolved
                ? "cursor-not-allowed bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "btn-press-active bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)]"
            }`}
          >
            <Icon name="check_circle" className="text-[18px]" />
            {isResolved ? "Resolvida" : "Marcar como resolvida"}
          </button>
        </>
      }
    >
      {/* Prev / Next quick nav */}
      <div className="mb-5 flex items-center justify-between gap-2 rounded-xl border border-[var(--color-outline-variant)] bg-white px-3 py-2">
        {adjacent.prev ? (
          <Link
            to="/app/demandas/$id"
            params={{ id: adjacent.prev.id }}
            preload="intent"
            className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
          >
            <Icon name="chevron_left" className="text-[16px]" />
            <span className="min-w-0 truncate">
              <span className="font-mono font-semibold">{adjacent.prev.id}</span>{" "}
              <span className="hidden sm:inline">• {adjacent.prev.title}</span>
            </span>
          </Link>
        ) : (
          <span />
        )}
        <span className="hidden text-[11px] text-[var(--color-on-surface-variant)] md:inline">
          Navegue entre demandas usando as setas
        </span>
        {adjacent.next ? (
          <Link
            to="/app/demandas/$id"
            params={{ id: adjacent.next.id }}
            preload="intent"
            className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
          >
            <span className="min-w-0 truncate">
              <span className="hidden sm:inline">{adjacent.next.title} • </span>
              <span className="font-mono font-semibold">{adjacent.next.id}</span>
            </span>
            <Icon name="chevron_right" className="text-[16px]" />
          </Link>
        ) : (
          <span />
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* MAIN */}
        <div className="space-y-5">
          {/* Header card */}
          <section className="card-elev rounded-2xl p-5 lg:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-[var(--color-surface-mid)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--color-on-surface-variant)]">
                {demanda.id}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${PRIO_CLASS[demanda.priority]}`}
              >
                {demanda.priority}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-outline-variant)] bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--color-navy)]">
                <Icon name={CAT_ICON[demanda.category]} className="text-[13px]" />
                {demanda.category}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-outline-variant)] bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--color-navy)]">
                <span className={`h-1.5 w-1.5 rounded-full ${columnMeta.accent}`} />
                {columnMeta.title}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${temp.class}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${temp.dot}`} />
                Conversa {temp.label}
              </span>
              {demanda.sla ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                  <Icon name="schedule" className="text-[13px]" /> {demanda.sla}
                </span>
              ) : null}
            </div>

            <h2 className="mt-4 text-xl font-bold leading-snug text-[var(--color-navy)] lg:text-2xl">
              {demanda.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-on-surface-variant)]">
              {demanda.description}
            </p>

            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--color-outline-variant)] pt-4 md:grid-cols-4">
              <InfoCell icon="place" label="Local" value={demanda.location} />
              <InfoCell icon="event" label="Aberta em" value={demanda.createdAt} />
              <InfoCell
                icon="person"
                label="Responsável"
                value={demanda.assigned ?? "Não atribuído"}
              />
              <InfoCell
                icon="payments"
                label="Custo estimado"
                value={
                  demanda.cost && demanda.cost.estimated > 0
                    ? `R$ ${demanda.cost.estimated.toLocaleString("pt-BR")}`
                    : "—"
                }
              />
            </dl>
          </section>

          {/* Conversation */}
          <section className="card-elev rounded-2xl p-5 lg:p-6">
            <header className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--color-navy)]">
                  Conversa com o morador
                </h3>
                <p className="text-xs text-[var(--color-on-surface-variant)]">
                  Canal: WhatsApp • Monitorado pelo Agente IA
                </p>
              </div>
              <button
                type="button"
                onClick={handleAssumir}
                disabled={assumed}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  assumed
                    ? "cursor-not-allowed border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy-soft)]"
                }`}
              >
                <Icon name={assumed ? "check" : "support_agent"} className="text-[14px]" />
                {assumed ? `Assumida por ${demanda.assumedBy}` : "Assumir conversa"}
              </button>
            </header>

            <div className="space-y-3">
              {demanda.messages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--color-outline-variant)] py-8 text-center text-xs text-[var(--color-on-surface-variant)]">
                  Nenhuma mensagem trocada nesta demanda.
                </div>
              ) : (
                demanda.messages.map((m, i) => <Bubble key={i} m={m} />)
              )}
            </div>

            <div className="mt-4 flex items-end gap-2 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] p-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={handleFilesSelected}
              />
              <button
                type="button"
                onClick={handlePickFiles}
                title="Anexar arquivo"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--color-on-surface-variant)] hover:bg-white"
              >
                <Icon name="attach_file" className="text-[18px]" />
              </button>
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                placeholder="Responder ao morador…"
                className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[var(--color-on-surface-variant)]"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!draft.trim()}
                className="btn-press btn-press-active inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-brand)] px-3 text-xs font-semibold text-white hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="send" className="text-[14px]" /> Enviar
              </button>
            </div>
          </section>

          {/* Timeline */}
          <section className="card-elev rounded-2xl p-5 lg:p-6">
            <h3 className="mb-4 text-base font-bold text-[var(--color-navy)]">
              Linha do tempo
            </h3>
            <ol className="relative space-y-4 border-l border-[var(--color-outline-variant)] pl-5">
              {demanda.timeline.map((t, i) => (
                <TimelineItem key={i} t={t} />
              ))}
            </ol>
          </section>
        </div>

        {/* SIDEBAR */}
        <aside className="space-y-5">
          <section className="card-elev rounded-2xl p-5">
            <h3 className="text-sm font-bold text-[var(--color-navy)]">
              Solicitante
            </h3>
            <div className="mt-3 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-[var(--color-navy)] text-sm font-bold text-white">
                {demanda.morador
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--color-on-surface)]">
                  {demanda.morador}
                </p>
                <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
                  {demanda.unit}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
              >
                <Icon name="chat" className="text-[16px]" />
                {demanda.contact.phone}
              </a>
              <a
                href={`mailto:${demanda.contact.email}`}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
              >
                <Icon name="mail" className="text-[16px]" />
                <span className="truncate">{demanda.contact.email}</span>
              </a>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-success)]/10 py-2 text-xs font-semibold text-[var(--color-success)] hover:bg-[var(--color-success)]/15"
              >
                <Icon name="chat" className="text-[14px]" /> WhatsApp
              </a>
              {demanda.moradorId ? (
                <Link
                  to="/app/moradores/$id"
                  params={{ id: demanda.moradorId }}
                  preload="intent"
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-surface-mid)] py-2 text-xs font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-high)]"
                >
                  <Icon name="badge" className="text-[14px]" /> Ficha
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Morador não vinculado"
                  className="flex cursor-not-allowed items-center justify-center gap-1.5 rounded-lg bg-[var(--color-surface-mid)] py-2 text-xs font-semibold text-[var(--color-on-surface-variant)] opacity-60"
                >
                  <Icon name="badge" className="text-[14px]" /> Ficha
                </button>
              )}
            </div>
          </section>

          <section className="card-elev rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--color-navy)]">
                Anexos
              </h3>
              <button
                type="button"
                onClick={handlePickFiles}
                className="text-xs font-semibold text-[var(--color-brand)] hover:underline"
              >
                + Adicionar
              </button>
            </div>
            {demanda.attachments.length === 0 ? (
              <p className="mt-3 rounded-lg bg-[var(--color-surface-low)] px-3 py-4 text-center text-xs text-[var(--color-on-surface-variant)]">
                Nenhum anexo enviado.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {demanda.attachments.map((a) => (
                  <li
                    key={a.name}
                    className="flex items-center gap-3 rounded-lg border border-[var(--color-outline-variant)] p-2.5 hover:bg-[var(--color-surface-mid)]"
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-surface-mid)] text-[var(--color-navy)]">
                      <Icon name={ATTACH_ICON[a.kind]} className="text-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-[var(--color-on-surface)]">
                        {a.name}
                      </p>
                      <p className="text-[10px] text-[var(--color-on-surface-variant)]">
                        {a.size}
                      </p>
                    </div>
                    {a.url ? (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={a.name}
                        className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-brand)]"
                      >
                        <Icon name="download" className="text-[16px]" />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {related.length > 0 ? (
            <section className="card-elev rounded-2xl p-5">
              <h3 className="text-sm font-bold text-[var(--color-navy)]">
                Demandas relacionadas
              </h3>
              <ul className="mt-3 space-y-2">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link
                      to="/app/demandas/$id"
                      params={{ id: r.id }}
                      preload="intent"
                      className="group block rounded-lg border border-[var(--color-outline-variant)] p-3 hover:border-[var(--color-brand)] hover:bg-[var(--color-surface-mid)]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-semibold text-[var(--color-on-surface-variant)]">
                          {r.id}
                        </span>
                        <span
                          className={`rounded-full border px-1.5 py-0 text-[9px] font-semibold ${PRIO_CLASS[r.priority]}`}
                        >
                          {r.priority}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs font-semibold text-[var(--color-navy)] group-hover:text-[var(--color-brand)]">
                        {r.title}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-[var(--color-on-surface-variant)]">
                        <Icon name={CAT_ICON[r.category]} className="text-[11px]" />
                        {r.category} • {r.unit}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[var(--color-navy)] px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </AppShell>
  );
}

function InfoCell({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-on-surface-variant)]">
        <Icon name={icon} className="text-[14px]" /> {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-[var(--color-navy)]">
        {value}
      </dd>
    </div>
  );
}

function Bubble({ m }: { m: Message }) {
  const isMine = m.from === "sindico";
  const isIA = m.from === "ia";
  return (
    <div className={`flex gap-3 ${isMine ? "flex-row-reverse" : ""}`}>
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white ${
          isIA
            ? "bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-navy)]"
            : isMine
              ? "bg-[var(--color-navy)]"
              : "bg-[var(--color-outline)]"
        }`}
      >
        {isIA ? (
          <Icon name="smart_toy" className="text-[16px]" />
        ) : (
          m.author
            .split(" ")
            .map((s) => s[0])
            .slice(0, 2)
            .join("")
        )}
      </div>
      <div className={`max-w-[78%] ${isMine ? "text-right" : ""}`}>
        <div className="mb-1 flex items-center gap-2 text-[10px] text-[var(--color-on-surface-variant)]">
          <span className="font-semibold text-[var(--color-navy)]">
            {m.author}
          </span>
          <span>{m.at}</span>
        </div>
        <div
          className={`inline-block rounded-2xl px-3.5 py-2.5 text-sm leading-snug ${
            isMine
              ? "rounded-tr-sm bg-[var(--color-brand)] text-white"
              : isIA
                ? "rounded-tl-sm border border-[var(--color-brand-soft)] bg-[var(--color-info-soft)] text-[var(--color-navy)]"
                : "rounded-tl-sm bg-[var(--color-surface-mid)] text-[var(--color-on-surface)]"
          }`}
        >
          {m.text}
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ t }: { t: TimelineEvent }) {
  return (
    <li className="relative">
      <span className="absolute -left-[26px] top-1 grid h-3 w-3 place-items-center rounded-full border-2 border-white bg-[var(--color-brand)] shadow" />
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-xs font-semibold text-[var(--color-navy)]">
          {t.actor}
        </span>
        <span className="text-[10px] font-mono text-[var(--color-on-surface-variant)]">
          {t.at}
        </span>
        {t.channel ? (
          <span className="rounded-full bg-[var(--color-surface-mid)] px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-[var(--color-on-surface-variant)]">
            {t.channel}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-[var(--color-on-surface-variant)]">{t.action}</p>
      {t.detail ? (
        <p className="mt-0.5 text-[11px] text-[var(--color-outline)]">
          {t.detail}
        </p>
      ) : null}
    </li>
  );
}

function DemandaNotFound() {
  const { id } = Route.useParams();
  return (
    <AppShell
      title="Demanda não encontrada"
      breadcrumbs={[
        { label: "OperaCondo" },
        { label: "Demandas", to: "/app/demandas" },
        { label: id },
      ]}
    >
      <div className="card-elev grid place-items-center rounded-2xl p-12 text-center">
        <Icon
          name="search_off"
          className="text-[48px] text-[var(--color-outline)]"
        />
        <h2 className="mt-3 text-lg font-bold text-[var(--color-navy)]">
          Não encontramos a demanda <span className="font-mono">{id}</span>
        </h2>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          Ela pode ter sido arquivada ou o link está incorreto.
        </p>
        <Link
          to="/app/demandas"
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover)]"
        >
          <Icon name="arrow_back" className="text-[16px]" /> Voltar ao Kanban
        </Link>
      </div>
    </AppShell>
  );
}

function DemandaError({ reset }: { reset: () => void }) {
  const router = useRouter();
  return (
    <AppShell title="Erro" breadcrumbs={[{ label: "Demandas", to: "/app/demandas" }]}>
      <div className="card-elev grid place-items-center rounded-2xl p-12 text-center">
        <Icon name="error" className="text-[48px] text-[var(--color-danger)]" />
        <h2 className="mt-3 text-lg font-bold text-[var(--color-navy)]">
          Ocorreu um erro ao carregar a demanda
        </h2>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover)]"
        >
          <Icon name="refresh" className="text-[16px]" /> Tentar novamente
        </button>
      </div>
    </AppShell>
  );
}
