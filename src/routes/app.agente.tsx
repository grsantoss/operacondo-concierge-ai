import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";

export const Route = createFileRoute("/app/agente")({
  head: () => ({
    meta: [{ title: "Monitoramento do Agente | Concierge OperaCondo" }],
  }),
  component: AgentePage,
});

type Temp = "cold" | "warm" | "hot";
type Status = "IA atendendo" | "Aguardando síndico" | "Síndico no controle" | "Resolvido";

interface Conv {
  id: string;
  morador: string;
  unidade: string;
  preview: string;
  temp: Temp;
  status: Status;
  time: string;
  avatar: string;
}

interface Msg {
  from: "morador" | "ia" | "sindico" | "sistema";
  time: string;
  text: string;
}

const TEMP_CLS: Record<Temp, { ring: string; bg: string; text: string; dot: string; label: string }> = {
  cold: { ring: "ring-blue-200", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "Tranquilo" },
  warm: { ring: "ring-amber-200", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Atenção" },
  hot: { ring: "ring-red-200", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Urgente" },
};

const INITIAL_CONVS: Conv[] = [
  { id: "c1", morador: "Ana Carvalho", unidade: "Apto 1204", preview: "Continua pingando, já está molhando o armário!", temp: "hot", status: "Aguardando síndico", time: "agora", avatar: "AC" },
  { id: "c2", morador: "Júlia Tavares", unidade: "Apto 506", preview: "O elevador está fazendo aquele barulho de novo.", temp: "warm", status: "IA atendendo", time: "há 6 min", avatar: "JT" },
  { id: "c3", morador: "Marcelo Reis", unidade: "Apto 802", preview: "Perfeito! Confirmado então para sábado.", temp: "cold", status: "Resolvido", time: "há 22 min", avatar: "MR" },
  { id: "c4", morador: "Bruno Lima", unidade: "Cob. 02", preview: "Recebi o boleto, obrigado!", temp: "cold", status: "Resolvido", time: "há 1h", avatar: "BL" },
  { id: "c5", morador: "Camila Duarte", unidade: "Apto 302", preview: "Posso liberar visitante para amanhã 14h?", temp: "cold", status: "IA atendendo", time: "há 1h", avatar: "CD" },
];

const INITIAL_TRANSCRIPTS: Record<string, Msg[]> = {
  c1: [
    { from: "morador", time: "11:42", text: "Boa tarde! Tem um vazamento embaixo da pia da cozinha." },
    { from: "ia", time: "11:42", text: "Olá Ana, sou o Concierge OperaCondo 👋 Sinto muito pelo transtorno. Há quanto tempo notou o vazamento?" },
    { from: "morador", time: "11:43", text: "Faz uns 20 minutos, está pingando bastante." },
    { from: "ia", time: "11:43", text: "Entendi. Vou abrir uma demanda crítica agora e acionar o Sr. Carlos da manutenção. Sugiro fechar o registro de água sob a pia (alavanca azul)." },
    { from: "morador", time: "11:51", text: "Continua pingando, já está molhando o armário!" },
  ],
  c2: [
    { from: "morador", time: "10:30", text: "O elevador está fazendo aquele barulho de novo." },
    { from: "ia", time: "10:30", text: "Registrado, Júlia. Já chamei a Elevatec para inspeção preventiva ainda hoje." },
  ],
  c3: [
    { from: "morador", time: "09:10", text: "Consegui confirmar a reserva do salão para sábado?" },
    { from: "ia", time: "09:10", text: "Sim! Reserva confirmada para sábado 19h–23h. Enviei o comprovante no seu e-mail." },
    { from: "morador", time: "09:12", text: "Perfeito! Confirmado então para sábado." },
  ],
  c4: [
    { from: "morador", time: "08:00", text: "Recebi o boleto, obrigado!" },
    { from: "ia", time: "08:00", text: "Ótimo, Bruno! Vencimento 10/07. Qualquer dúvida estou por aqui." },
  ],
  c5: [
    { from: "morador", time: "08:45", text: "Posso liberar visitante para amanhã 14h?" },
    { from: "ia", time: "08:45", text: "Claro! Nome completo e documento do visitante, por favor?" },
  ],
};

type Tone = "formal" | "cordial" | "direto";
const TONES: { id: Tone; label: string; desc: string; sample: string }[] = [
  { id: "formal", label: "Formal", desc: "Trato cerimonioso, ideal para condomínios corporativos.", sample: "Prezado(a) morador(a), registramos sua solicitação e retornaremos em breve." },
  { id: "cordial", label: "Cordial", desc: "Equilíbrio entre acolhimento e profissionalismo (padrão).", sample: "Olá! Recebi sua mensagem e já estou cuidando disso para você 🙂" },
  { id: "direto", label: "Direto", desc: "Objetivo e resolutivo, sem rodeios.", sample: "Recebido. Abrindo a demanda agora. Retorno em até 30 min." },
];

function AgentePage() {
  const navigate = useNavigate();
  const [convs, setConvs] = useState<Conv[]>(INITIAL_CONVS);
  const [transcripts, setTranscripts] = useState<Record<string, Msg[]>>(INITIAL_TRANSCRIPTS);
  const [selectedId, setSelectedId] = useState<string>(INITIAL_CONVS[0].id);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [tone, setTone] = useState<Tone>("cordial");
  const [toneOpen, setToneOpen] = useState(false);
  const [demandaOpen, setDemandaOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selected = convs.find((c) => c.id === selectedId) ?? convs[0];
  const t = TEMP_CLS[selected.temp];
  const messages = transcripts[selected.id] ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return convs;
    return convs.filter(
      (c) => c.morador.toLowerCase().includes(q) || c.unidade.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q),
    );
  }, [convs, search]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, selectedId]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const now = () =>
    new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  function pushMsg(convId: string, msg: Msg, previewOverride?: string) {
    setTranscripts((prev) => ({ ...prev, [convId]: [...(prev[convId] ?? []), msg] }));
    setConvs((prev) =>
      prev.map((c) =>
        c.id === convId ? { ...c, preview: previewOverride ?? msg.text, time: "agora" } : c,
      ),
    );
  }

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    pushMsg(selected.id, { from: "sindico", time: now(), text });
    setConvs((prev) =>
      prev.map((c) => (c.id === selected.id ? { ...c, status: "Síndico no controle" } : c)),
    );
    setDraft("");
    setToast("Mensagem enviada");
  }

  function handleAssumir() {
    if (selected.status === "Síndico no controle") {
      setConvs((prev) =>
        prev.map((c) => (c.id === selected.id ? { ...c, status: "IA atendendo" } : c)),
      );
      pushMsg(selected.id, { from: "sistema", time: now(), text: "IA retomou o atendimento." });
      setToast("IA retomou a conversa");
    } else {
      setConvs((prev) =>
        prev.map((c) => (c.id === selected.id ? { ...c, status: "Síndico no controle" } : c)),
      );
      pushMsg(selected.id, { from: "sistema", time: now(), text: "Síndico assumiu a conversa. IA pausada." });
      setToast("Você assumiu a conversa");
    }
  }

  function handleAbrirDemanda(payload: { titulo: string; categoria: string; prioridade: string }) {
    pushMsg(
      selected.id,
      {
        from: "sistema",
        time: now(),
        text: `Demanda aberta: "${payload.titulo}" • ${payload.categoria} • prioridade ${payload.prioridade}.`,
      },
      `Demanda criada: ${payload.titulo}`,
    );
    setDemandaOpen(false);
    setToast("Demanda criada com sucesso");
  }

  return (
    <AppShell
      title="Monitoramento do Agente IA"
      breadcrumbs={[{ label: "OperaCondo" }, { label: "Agente IA" }]}
      actions={
        <button
          onClick={() => setToneOpen(true)}
          className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)]"
        >
          <Icon name="tune" className="text-[18px]" /> Tom de voz:{" "}
          <span className="text-[var(--color-brand)]">{TONES.find((x) => x.id === tone)?.label}</span>
        </button>
      }
    >
      {/* KPIs */}
      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { l: "Conversas ativas", v: String(convs.filter((c) => c.status !== "Resolvido").length), i: "forum" },
          { l: "Resolução autônoma", v: "94%", i: "verified" },
          { l: "Tempo médio IA", v: "23s", i: "schedule" },
          { l: "Intervenções humanas (24h)", v: String(convs.filter((c) => c.status === "Síndico no controle").length + 3), i: "front_hand" },
        ].map((m) => (
          <div key={m.l} className="card-elev rounded-xl p-4">
            <div className="flex items-center gap-2 text-[var(--color-on-surface-variant)]">
              <Icon name={m.i} className="text-[18px]" />
              <p className="text-xs font-semibold uppercase tracking-wider">{m.l}</p>
            </div>
            <p className="mt-1.5 text-2xl font-bold text-[var(--color-navy)]">{m.v}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* List */}
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
                className="w-full rounded-lg border border-[var(--color-outline-variant)] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15"
              />
            </div>
          </div>
          <ul className="max-h-[640px] overflow-y-auto custom-scrollbar">
            {filtered.map((c) => {
              const tc = TEMP_CLS[c.temp];
              const active = c.id === selected.id;
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
                      {c.avatar}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-[var(--color-navy)]">{c.morador}</p>
                        <span className="shrink-0 text-[10px] text-[var(--color-on-surface-variant)]">{c.time}</span>
                      </div>
                      <p className="text-[11px] text-[var(--color-on-surface-variant)]">{c.unidade}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-on-surface-variant)]">{c.preview}</p>
                      <span
                        className={`mt-2 inline-flex items-center gap-1 rounded-full ${tc.bg} px-2 py-0.5 text-[10px] font-semibold ${tc.text}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${tc.dot}`} />
                        {tc.label}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="p-6 text-center text-xs text-[var(--color-on-surface-variant)]">Nenhuma conversa encontrada.</li>
            )}
          </ul>
        </aside>

        {/* Transcript */}
        <div className="card-elev flex flex-col overflow-hidden rounded-2xl">
          <header className="flex items-center justify-between gap-3 border-b border-[var(--color-outline-variant)] p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-navy)] text-sm font-bold text-white ring-2 ${t.ring}`}>
                {selected.avatar}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--color-navy)]">
                  {selected.morador} <span className="font-normal text-[var(--color-on-surface-variant)]">• {selected.unidade}</span>
                </p>
                <p className="flex items-center gap-2 text-[11px] text-[var(--color-on-surface-variant)]">
                  <span className="inline-flex items-center gap-1">
                    <Icon name={selected.status === "Síndico no controle" ? "person" : "smart_toy"} className="text-[12px]" /> {selected.status}
                  </span>
                  <span>•</span>
                  <span className={`inline-flex items-center gap-1 rounded-full ${t.bg} px-2 py-0.5 text-[10px] font-semibold ${t.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
                    Temperatura: {t.label}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDemandaOpen(true)}
                className="btn-press btn-press-active hidden items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)] md:inline-flex"
              >
                <Icon name="assignment_add" className="text-[16px]" /> Abrir demanda
              </button>
              <button
                onClick={handleAssumir}
                className={`btn-press btn-press-active inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white ${
                  selected.status === "Síndico no controle"
                    ? "bg-[var(--color-navy)] hover:opacity-90"
                    : "bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)]"
                }`}
              >
                <Icon name={selected.status === "Síndico no controle" ? "smart_toy" : "pan_tool"} className="text-[16px]" />
                {selected.status === "Síndico no controle" ? "Devolver para IA" : "Assumir conversa"}
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-[var(--color-surface-low)] p-5 custom-scrollbar" style={{ maxHeight: 520 }}>
            {messages.map((m, i) => {
              if (m.from === "sistema") {
                return (
                  <div key={i} className="mx-auto max-w-md rounded-full bg-[var(--color-outline-variant)]/60 px-3 py-1 text-center text-[11px] text-[var(--color-on-surface-variant)]">
                    {m.text} • {m.time}
                  </div>
                );
              }
              const isMineSide = m.from === "sindico" || m.from === "ia";
              const isSindico = m.from === "sindico";
              const isIA = m.from === "ia";
              return (
                <div key={i} className={`flex max-w-[80%] flex-col gap-1 ${isMineSide ? "ml-auto items-end" : ""}`}>
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                      isSindico
                        ? "bg-[var(--color-navy)] text-white"
                        : isIA
                          ? "bg-[var(--color-brand)] text-white"
                          : "bg-white text-[var(--color-on-surface)]"
                    }`}
                  >
                    {m.text}
                  </div>
                  <span className="px-1 text-[10px] text-[var(--color-on-surface-variant)]">
                    {isSindico ? "Você (síndico)" : isIA ? "Concierge IA" : selected.morador} • {m.time}
                  </span>
                </div>
              );
            })}
          </div>

          <footer className="border-t border-[var(--color-outline-variant)] bg-white p-3">
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => setToast("Anexos disponíveis em breve")}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
              >
                <Icon name="attach_file" />
              </button>
              <textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`Escreva com tom ${TONES.find((x) => x.id === tone)?.label.toLowerCase()}…`}
                className="max-h-28 flex-1 resize-none rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15"
              />
              <button
                onClick={handleSend}
                disabled={!draft.trim()}
                className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="send" className="text-[18px]" /> Enviar
              </button>
            </div>
            <p className="mt-2 px-1 text-[10px] text-[var(--color-on-surface-variant)]">
              Pressione Enter para enviar • Shift+Enter para nova linha • IA pausa automaticamente quando o síndico responde
            </p>
          </footer>
        </div>
      </section>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--color-navy)] px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Tom de voz modal */}
      {toneOpen && (
        <Modal title="Tom de voz do agente" onClose={() => setToneOpen(false)}>
          <div className="space-y-3">
            {TONES.map((opt) => {
              const active = tone === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setTone(opt.id)}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    active
                      ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]/50 ring-2 ring-[var(--color-brand)]/20"
                      : "border-[var(--color-outline-variant)] hover:bg-[var(--color-surface-low)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[var(--color-navy)]">{opt.label}</p>
                    {active && <Icon name="check_circle" className="text-[18px] text-[var(--color-brand)]" />}
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">{opt.desc}</p>
                  <p className="mt-2 rounded-md bg-[var(--color-surface-low)] px-3 py-2 text-xs italic text-[var(--color-on-surface)]">
                    “{opt.sample}”
                  </p>
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setToneOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-low)]"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                setToneOpen(false);
                setToast(`Tom de voz atualizado para "${TONES.find((x) => x.id === tone)?.label}"`);
              }}
              className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover)]"
            >
              Salvar
            </button>
          </div>
        </Modal>
      )}

      {/* Abrir demanda modal */}
      {demandaOpen && (
        <DemandaModal
          morador={selected.morador}
          unidade={selected.unidade}
          onClose={() => setDemandaOpen(false)}
          onSubmit={handleAbrirDemanda}
          onOpenFull={() => {
            setDemandaOpen(false);
            navigate({
              to: "/app/demandas/nova",
              search: { moradorId: undefined, condominioId: undefined },
            });
          }}
        />
      )}
    </AppShell>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--color-navy)]">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-low)]">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DemandaModal({
  morador,
  unidade,
  onClose,
  onSubmit,
  onOpenFull,
}: {
  morador: string;
  unidade: string;
  onClose: () => void;
  onSubmit: (v: { titulo: string; categoria: string; prioridade: string }) => void;
  onOpenFull: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState("Manutenção");
  const [prioridade, setPrioridade] = useState("Alta");

  return (
    <Modal title="Abrir demanda a partir da conversa" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg bg-[var(--color-surface-low)] p-3 text-xs text-[var(--color-on-surface-variant)]">
          <strong className="text-[var(--color-navy)]">{morador}</strong> • {unidade}
        </div>
        <Field label="Título">
          <input
            autoFocus
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Vazamento na pia da cozinha"
            className="w-full rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria">
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
            >
              {["Manutenção", "Segurança", "Limpeza", "Financeiro", "Convivência", "Outros"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Prioridade">
            <select
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
            >
              {["Crítica", "Alta", "Média", "Baixa"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-2">
        <button
          onClick={onOpenFull}
          className="text-xs font-semibold text-[var(--color-brand)] hover:underline"
        >
          Abrir formulário completo →
        </button>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-low)]"
          >
            Cancelar
          </button>
          <button
            disabled={!titulo.trim()}
            onClick={() => onSubmit({ titulo: titulo.trim(), categoria, prioridade })}
            className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Criar demanda
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--color-on-surface-variant)]">{label}</span>
      {children}
    </label>
  );
}
