import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";

export const Route = createFileRoute("/app/agente")({
  head: () => ({
    meta: [{ title: "Monitoramento do Agente | Concierge OperaCondo" }],
  }),
  component: AgentePage,
});

type Temp = "cold" | "warm" | "hot";

interface Conv {
  id: string;
  morador: string;
  unidade: string;
  preview: string;
  temp: Temp;
  status: "IA atendendo" | "Aguardando síndico" | "Resolvido";
  time: string;
  avatar: string;
}

const TEMP_CLS: Record<Temp, { ring: string; bg: string; text: string; dot: string; label: string }> = {
  cold: { ring: "ring-blue-200", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "Tranquilo" },
  warm: { ring: "ring-amber-200", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Atenção" },
  hot: { ring: "ring-red-200", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Urgente" },
};

const CONVS: Conv[] = [
  { id: "c1", morador: "Ana Carvalho", unidade: "Apto 1204", preview: "Continua pingando, já está molhando o armário!", temp: "hot", status: "Aguardando síndico", time: "agora", avatar: "AC" },
  { id: "c2", morador: "Júlia Tavares", unidade: "Apto 506", preview: "O elevador está fazendo aquele barulho de novo.", temp: "warm", status: "IA atendendo", time: "há 6 min", avatar: "JT" },
  { id: "c3", morador: "Marcelo Reis", unidade: "Apto 802", preview: "Perfeito! Confirmado então para sábado.", temp: "cold", status: "Resolvido", time: "há 22 min", avatar: "MR" },
  { id: "c4", morador: "Bruno Lima", unidade: "Cob. 02", preview: "Recebi o boleto, obrigado!", temp: "cold", status: "Resolvido", time: "há 1h", avatar: "BL" },
  { id: "c5", morador: "Camila Duarte", unidade: "Apto 302", preview: "Posso liberar visitante para amanhã 14h?", temp: "cold", status: "IA atendendo", time: "há 1h", avatar: "CD" },
];

const TRANSCRIPT = [
  { from: "morador", time: "11:42", text: "Boa tarde! Tem um vazamento embaixo da pia da cozinha." },
  {
    from: "ia",
    time: "11:42",
    text: "Olá Ana, sou o Concierge OperaCondo 👋 Sinto muito pelo transtorno. Para registrar a demanda corretamente, você pode me dizer há quanto tempo notou o vazamento?",
  },
  { from: "morador", time: "11:43", text: "Faz uns 20 minutos, está pingando bastante." },
  {
    from: "ia",
    time: "11:43",
    text: "Entendi. Vou abrir uma demanda crítica agora e acionar o Sr. Carlos da manutenção. Enquanto isso, sugiro fechar o registro de água sob a pia (a alavanca azul). Posso te enviar uma foto de orientação?",
  },
  { from: "morador", time: "11:51", text: "Continua pingando, já está molhando o armário!" },
];

function AgentePage() {
  const [selected, setSelected] = useState<Conv>(CONVS[0]);
  const t = TEMP_CLS[selected.temp];

  return (
    <AppShell
      title="Monitoramento do Agente IA"
      breadcrumbs={[{ label: "OperaCondo" }, { label: "Agente IA" }]}
      actions={
        <button className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)]">
          <Icon name="tune" className="text-[18px]" /> Tom de voz
        </button>
      }
    >
      {/* Live KPIs */}
      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { l: "Conversas ativas", v: "14", i: "forum" },
          { l: "Resolução autônoma", v: "94%", i: "verified" },
          { l: "Tempo médio IA", v: "23s", i: "schedule" },
          { l: "Intervenções humanas (24h)", v: "3", i: "front_hand" },
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

      {/* Split: conversation list + transcript */}
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
                placeholder="Buscar conversa…"
                className="w-full rounded-lg border border-[var(--color-outline-variant)] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15"
              />
            </div>
          </div>
          <ul className="max-h-[640px] overflow-y-auto custom-scrollbar">
            {CONVS.map((c) => {
              const tc = TEMP_CLS[c.temp];
              const active = c.id === selected.id;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setSelected(c)}
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
                        <p className="truncate text-sm font-semibold text-[var(--color-navy)]">
                          {c.morador}
                        </p>
                        <span className="shrink-0 text-[10px] text-[var(--color-on-surface-variant)]">
                          {c.time}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--color-on-surface-variant)]">
                        {c.unidade}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-on-surface-variant)]">
                        {c.preview}
                      </p>
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
                    <Icon name="smart_toy" className="text-[12px]" /> IA atendendo
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
              <button className="btn-press btn-press-active hidden items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)] md:inline-flex">
                <Icon name="assignment_add" className="text-[16px]" /> Abrir demanda
              </button>
              <button className="btn-press btn-press-active inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--color-brand-hover)]">
                <Icon name="pan_tool" className="text-[16px]" /> Assumir conversa
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto bg-[var(--color-surface-low)] p-5 custom-scrollbar">
            {TRANSCRIPT.map((m, i) => {
              const isIA = m.from === "ia";
              return (
                <div
                  key={i}
                  className={`flex max-w-[80%] flex-col gap-1 ${isIA ? "" : "ml-auto items-end"}`}
                >
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                      isIA
                        ? "bg-white text-[var(--color-on-surface)]"
                        : "bg-[var(--color-brand)] text-white"
                    }`}
                  >
                    {m.text}
                  </div>
                  <span className="px-1 text-[10px] text-[var(--color-on-surface-variant)]">
                    {isIA ? "Concierge IA" : selected.morador} • {m.time}
                  </span>
                </div>
              );
            })}
          </div>

          <footer className="border-t border-[var(--color-outline-variant)] bg-white p-3">
            <div className="flex items-end gap-2">
              <button className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]">
                <Icon name="attach_file" />
              </button>
              <textarea
                rows={1}
                placeholder="Escreva uma resposta como síndico…"
                className="max-h-28 flex-1 resize-none rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15"
              />
              <button className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover)]">
                <Icon name="send" className="text-[18px]" /> Enviar
              </button>
            </div>
            <p className="mt-2 px-1 text-[10px] text-[var(--color-on-surface-variant)]">
              Pressione Enter para enviar • Shift+Enter para nova linha • IA pausa
              automaticamente quando o síndico responde
            </p>
          </footer>
        </div>
      </section>
    </AppShell>
  );
}
