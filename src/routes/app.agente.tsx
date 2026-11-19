import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Mail, MessageCircle, Pencil, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";
import {
  conversasQuery,
  ESTADO_LABEL,
  useConversaAcoes,
  useConversas,
  useMensagens,
  type ConversaResumo,
  type MensagemConversa,
} from "@/data/conversas";
import { URGENCIA } from "@/lib/urgencia";

export const Route = createFileRoute("/app/agente")({
  head: () => ({
    meta: [{ title: "Conversas | OperaCondo Concierge" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(conversasQuery),
  component: AgentePage,
});

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function quando(iso: string) {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 24 * 60) return hora(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const CANAL = {
  whatsapp: { rotulo: "WhatsApp", Icone: MessageCircle },
  email: { rotulo: "E-mail", Icone: Mail },
} as const;
const FILTROS = [
  { id: "todos", rotulo: "Todos" },
  { id: "whatsapp", rotulo: "WhatsApp" },
  { id: "email", rotulo: "E-mail" },
] as const;

const iniciais = (c: ConversaResumo) =>
  c.conhecido
    ? c.nome
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
    : "?";

function erroTexto(err: unknown) {
  const m = (err as Error).message;
  try {
    const l = JSON.parse(m) as { message: string }[];
    if (Array.isArray(l)) return l.map((x) => x.message).join(" ");
  } catch {
    /* mensagem comum */
  }
  return m;
}

function AgentePage() {
  const navigate = useNavigate();
  const { data: convs = [] } = useConversas();
  const acoes = useConversaAcoes();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtroCanal, setFiltroCanal] = useState<(typeof FILTROS)[number]["id"]>("todos");
  const [draft, setDraft] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const criticas = convs.filter((c) => c.urgencia === "Crítica" && c.estado !== "resolvida");
  const selected = convs.find((c) => c.id === selectedId) ?? convs[0] ?? null;
  const { data: messages = [] } = useMensagens(selected?.id ?? null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const doCanal = filtroCanal === "todos" ? convs : convs.filter((c) => c.canal === filtroCanal);
    if (!q) return doCanal;
    return doCanal.filter((c) =>
      [c.nome, c.contato, c.unidade, c.condominio, c.preview].some((x) =>
        x?.toLowerCase().includes(q),
      ),
    );
  }, [convs, search, filtroCanal]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, selected?.id]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  async function executar(fn: () => Promise<void>, ok: string) {
    setOcupado(true);
    try {
      await fn();
      setToast(ok);
    } catch (err) {
      setToast(erroTexto(err));
    } finally {
      setOcupado(false);
    }
  }

  function handleSend(texto = draft) {
    const text = texto.trim();
    if (!text || !selected) return;
    void executar(async () => {
      await acoes.responder(selected.id, text);
      setDraft("");
    }, selected.canal === "email" ? "E-mail enviado" : "Mensagem enviada");
  }

  const kpis = [
    { l: "Conversas abertas", v: convs.filter((c) => c.estado !== "resolvida").length, i: "forum" },
    {
      l: "Aguardando síndico",
      v: convs.filter((c) => c.estado === "aguardando_sindico").length,
      i: "schedule",
    },
    { l: "Com o síndico", v: convs.filter((c) => c.estado === "sindico").length, i: "front_hand" },
    { l: "Resolvidas", v: convs.filter((c) => c.estado === "resolvida").length, i: "verified" },
  ];

  return (
    <AppShell
      title="Conversas"
      breadcrumbs={[{ label: "OperaCondo" }, { label: "Agente IA" }]}
    >
      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((m) => (
          <div key={m.l} className="card-elev rounded-xl p-4">
            <div className="flex items-center gap-2 text-[var(--color-on-surface-variant)]">
              <Icon name={m.i} className="text-[18px]" />
              <p className="text-xs font-semibold uppercase tracking-wider">{m.l}</p>
            </div>
            <p className="mt-1.5 text-2xl font-bold text-[var(--color-navy)]">{m.v}</p>
          </div>
        ))}
      </section>

      {criticas.length ? (
        <section
          role="alert"
          className="mb-5 rounded-2xl border border-destructive/30 bg-destructive/10 p-4"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <Icon name="warning" className="text-[18px]" />
            {criticas.length === 1
              ? "1 conversa com urgência Crítica"
              : `${criticas.length} conversas com urgência Crítica`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {criticas.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="rounded-full border border-destructive/30 bg-white px-3 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10"
              >
                {c.nome}
                {c.condominio ? ` • ${c.condominio}` : ""}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {!selected ? (
        <div className="card-elev rounded-2xl p-8 text-center">
          <Icon name="forum" className="text-[40px] text-[var(--color-on-surface-variant)]" />
          <p className="mt-2 text-sm font-semibold text-[var(--color-navy)]">
            Nenhuma conversa ainda
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-[var(--color-on-surface-variant)]">
            Quando um morador mandar mensagem pelo WhatsApp ou e-mail do condomínio, a conversa
            aparece aqui na hora. Confira os canais em Configurações → Integrações.
          </p>
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="card-elev overflow-hidden rounded-2xl">
            <div className="border-b border-[var(--color-outline-variant)] p-3">
              <div className="relative">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--color-on-surface-variant)]"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar conversa…"
                  aria-label="Buscar conversa"
                  className="w-full rounded-lg border border-[var(--color-outline-variant)] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15"
                />
              </div>
              <div className="mt-2 flex gap-1.5" role="group" aria-label="Filtrar por canal">
                {FILTROS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={filtroCanal === f.id}
                    onClick={() => setFiltroCanal(f.id)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      filtroCanal === f.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {f.rotulo}
                  </button>
                ))}
              </div>
            </div>
            <ul className="custom-scrollbar max-h-[640px] overflow-y-auto">
              {filtered.map((c) => {
                const tc = URGENCIA[c.urgencia];
                const active = c.id === selected.id;
                const { Icone, rotulo } = CANAL[c.canal];
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelectedId(c.id)}
                      className={`grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-3 border-l-2 p-3.5 text-left transition ${
                        active
                          ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]/60"
                          : "border-transparent hover:bg-[var(--color-surface-low)]"
                      }`}
                    >
                      <div
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-navy)] text-xs font-bold text-white ring-2 ${tc.ring}`}
                      >
                        {iniciais(c)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-[var(--color-navy)]">
                            {c.nome}
                          </p>
                          <span className="flex shrink-0 items-center gap-1 text-[10px] text-[var(--color-on-surface-variant)]">
                            <Icone className="size-3.5" aria-label={rotulo} />
                            {quando(c.ultimaMsgEm)}
                          </span>
                        </div>
                        <p className="truncate text-[11px] text-[var(--color-on-surface-variant)]">
                          {[c.condominio ?? "Condomínio a definir", c.unidade]
                            .filter(Boolean)
                            .join(" • ")}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--color-on-surface-variant)]">
                          {c.preview}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full ${tc.bg} px-2 py-0.5 text-[10px] font-semibold ${tc.text}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${tc.dot}`} />
                            {c.urgencia}
                          </span>
                          <span className="inline-flex rounded-full bg-[var(--color-surface-mid)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-on-surface-variant)]">
                            {ESTADO_LABEL[c.estado]}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="p-6 text-center text-xs text-[var(--color-on-surface-variant)]">
                  Nenhuma conversa encontrada.
                </li>
              )}
            </ul>
          </aside>

          <div className="card-elev flex min-w-0 flex-col overflow-hidden rounded-2xl">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-outline-variant)] p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-navy)] text-sm font-bold text-white ring-2 ${URGENCIA[selected.urgencia].ring}`}
                >
                  {iniciais(selected)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--color-navy)]">
                    {selected.nome}
                    {selected.conhecido ? (
                      <span className="font-normal text-[var(--color-on-surface-variant)]">
                        {" "}
                        • {selected.contato}
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-[11px] text-[var(--color-on-surface-variant)]">
                    {[
                      selected.condominio ?? "Condomínio ainda não definido",
                      selected.unidade,
                      !selected.conhecido
                        ? selected.canal === "email"
                          ? "Remetente não cadastrado"
                          : "Número não cadastrado"
                        : null,
                      selected.cadastro === "pendente" ? "Cadastro pendente" : null,
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-on-surface-variant)]">
                    <span className="inline-flex items-center gap-1">
                      {selected.canal === "email" ? (
                        <Mail className="size-3" aria-hidden />
                      ) : (
                        <MessageCircle className="size-3" aria-hidden />
                      )}
                      {CANAL[selected.canal].rotulo}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Icon
                        name={selected.estado === "sindico" ? "person" : "smart_toy"}
                        className="text-[12px]"
                      />
                      {ESTADO_LABEL[selected.estado]}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full ${URGENCIA[selected.urgencia].bg} px-2 py-0.5 text-[10px] font-semibold ${URGENCIA[selected.urgencia].text}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${URGENCIA[selected.urgencia].dot}`}
                      />
                      Urgência: {selected.urgencia}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selected.condominioId ? (
                  <button
                    onClick={() =>
                      navigate({
                        to: "/app/demandas/nova",
                        search: {
                          moradorId: selected.moradorId ?? undefined,
                          condominioId: selected.condominioId ?? undefined,
                        },
                      })
                    }
                    className="btn-press inline-flex items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)]"
                  >
                    <Icon name="assignment_add" className="text-[16px]" /> Abrir demanda
                  </button>
                ) : null}
                {selected.estado !== "sindico" && selected.estado !== "resolvida" ? (
                  <button
                    disabled={ocupado}
                    onClick={() =>
                      void executar(() => acoes.assumir(selected.id), "Você assumiu a conversa")
                    }
                    className="btn-press inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--color-brand-hover)] disabled:opacity-60"
                  >
                    <Icon name="pan_tool" className="text-[16px]" /> Assumir conversa
                  </button>
                ) : null}
                {selected.estado !== "resolvida" ? (
                  <button
                    disabled={ocupado}
                    onClick={() =>
                      void executar(
                        () => acoes.resolver(selected.id),
                        "Conversa marcada como resolvida",
                      )
                    }
                    className="btn-press inline-flex items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)] disabled:opacity-60"
                  >
                    <Icon name="check_circle" className="text-[16px]" /> Resolver
                  </button>
                ) : null}
              </div>
            </header>

            <div
              ref={scrollRef}
              className="custom-scrollbar flex-1 space-y-4 overflow-y-auto bg-[var(--color-surface-low)] p-5"
              style={{ maxHeight: 520 }}
            >
              {messages.map((m) => {
                const doMorador = m.direcao === "entrada";
                const cor =
                  m.autor === "sindico"
                    ? "bg-[var(--color-navy)] text-white"
                    : m.autor === "ia"
                      ? "bg-[var(--color-brand)] text-white"
                      : m.autor === "sistema"
                        ? "border border-[var(--color-outline-variant)] bg-white/70 text-[var(--color-on-surface-variant)]"
                        : "bg-white text-[var(--color-on-surface)]";
                const quem =
                  m.autor === "sindico"
                    ? "Síndico"
                    : m.autor === "ia"
                      ? "Concierge IA"
                      : m.autor === "sistema"
                        ? "Mensagem automática"
                        : selected.nome;
                return (
                  <div
                    key={m.id}
                    className={`flex max-w-[80%] flex-col gap-1 ${doMorador ? "" : "ml-auto items-end"}`}
                  >
                    <div
                      className={`whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-soft ${cor}`}
                    >
                      <Conteudo m={m} />
                    </div>
                    <span className="px-1 text-[10px] text-[var(--color-on-surface-variant)]">
                      {quem} • {hora(m.criadoEm)}
                    </span>
                  </div>
                );
              })}
            </div>

            {selected.rascunhoMotivo && selected.estado !== "resolvida" && (
              <div
                className="border-t border-border bg-warning-soft px-4 py-3"
                aria-label="Rascunho da IA"
              >
                <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Sparkles className="size-3.5" aria-hidden />
                  {selected.rascunho ? "Rascunho da IA" : "Encaminhada pela IA"}
                  <span className="font-normal text-muted-foreground">
                    • {selected.rascunhoMotivo}
                  </span>
                </p>
                {selected.rascunho ? (
                  <>
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground">
                      {selected.rascunho}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleSend(selected.rascunho!)}
                        disabled={ocupado}
                        className="btn-press inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        <Check className="size-3.5" aria-hidden /> Aprovar e enviar
                      </button>
                      <button
                        onClick={() => setDraft(selected.rascunho!)}
                        className="btn-press inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-foreground"
                      >
                        <Pencil className="size-3.5" aria-hidden /> Editar
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Responda abaixo.</p>
                )}
              </div>
            )}

            <footer className="border-t border-[var(--color-outline-variant)] bg-white p-3">
              <div className="flex items-end gap-2">
                <textarea
                  rows={selected.canal === "email" ? 4 : 1}
                  value={draft}
                  aria-label="Mensagem para o morador"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    // E-mail tem parágrafos: Enter quebra linha e Ctrl+Enter envia.
                    const envia =
                      selected.canal === "email"
                        ? e.ctrlKey || e.metaKey
                        : !e.shiftKey;
                    if (e.key === "Enter" && envia) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    selected.canal === "email" ? "Responder por e-mail…" : "Responder pelo WhatsApp…"
                  }
                  className="max-h-28 min-w-0 flex-1 resize-none rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!draft.trim() || ocupado}
                  className="btn-press inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon name="send" className="text-[18px]" /> Enviar
                </button>
              </div>
              <p className="mt-2 px-1 text-[10px] text-[var(--color-on-surface-variant)]">
                {selected.canal === "email"
                  ? "Ctrl+Enter envia • A resposta sai na mesma conversa de e-mail"
                  : "Enter envia • Shift+Enter quebra linha"}{" "}
                • Ao responder, você assume a conversa
              </p>
            </footer>
          </div>
        </section>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-full bg-[var(--color-navy)] px-4 py-2 text-center text-xs font-semibold text-white shadow-elevated"
        >
          {toast}
        </div>
      )}
    </AppShell>
  );
}

/** Texto, imagem, áudio (com transcrição) ou link do arquivo. */
function Conteudo({ m }: { m: MensagemConversa }) {
  if (!m.midiaUrl)
    return (
      <>
        {m.assunto ? <p className="mb-1 font-semibold">{m.assunto}</p> : null}
        {m.texto}
      </>
    );
  if (m.tipo === "imagem")
    return (
      <>
        <a href={m.midiaUrl} target="_blank" rel="noreferrer">
          <img
            src={m.midiaUrl}
            alt={m.texto ?? "Imagem enviada pelo morador"}
            className="max-h-64 max-w-full rounded-lg"
          />
        </a>
        {m.texto ? <p className="mt-1.5">{m.texto}</p> : null}
      </>
    );
  if (m.tipo === "audio")
    return (
      <>
        <audio controls preload="none" src={m.midiaUrl} className="max-w-full" />
        <p className="mt-1.5 text-xs italic opacity-80">
          {m.transcricao ? `Transcrição: ${m.transcricao}` : "Áudio sem transcrição."}
        </p>
      </>
    );
  return (
    <a href={m.midiaUrl} target="_blank" rel="noreferrer" className="underline">
      📎 {m.texto ?? "Abrir arquivo"}
    </a>
  );
}
