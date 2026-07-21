import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Icon } from "@/components/brand/Icon";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [{ title: "Onboarding | Concierge OperaCondo" }],
  }),
  component: OnboardingPage,
});

const STEPS = [
  { n: 1, title: "Configuração do gestor", desc: "Tom de voz e comportamento" },
  { n: 2, title: "Dados do condomínio", desc: "CNPJ, endereço, unidades" },
  { n: 3, title: "Regras específicas", desc: "Silêncio, reclamações e chamados" },
  { n: 4, title: "Conectar WhatsApp", desc: "Z-API ou API oficial da Meta" },
  { n: 5, title: "Revisão final", desc: "Verificação e ativação" },
];
const TOTAL_STEPS = 5;

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-[var(--color-surface)] lg:grid-cols-[320px_minmax(0,1fr)]">
      {/* Sidebar — stepper */}
      <aside className="bg-[var(--color-navy-deep)] text-white lg:min-h-screen">
        <div className="border-b border-white/10 p-6">
          <Logo variant="light" to="/" />
        </div>
        <div className="p-6">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
            Setup inicial
          </p>
          <h2 className="text-xl font-bold tracking-tight">
            Vamos preparar seu condomínio
          </h2>
          <p className="mt-1 text-sm text-white/65">
            Em ~10 minutos seu Concierge estará operando.
          </p>

          <ol className="mt-8 space-y-1">
            {STEPS.map((s) => {
              const done = s.n < step;
              const active = s.n === step;
              return (
                <li key={s.n}>
                  <button
                    onClick={() => setStep(s.n)}
                    className={`grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-xl p-3 text-left transition ${
                      active
                        ? "bg-white/12"
                        : done
                        ? "hover:bg-white/8"
                        : "opacity-70 hover:bg-white/5"
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition ${
                        done
                          ? "bg-[var(--color-brand-fixed)] text-[var(--color-navy-deep)]"
                          : active
                          ? "bg-white text-[var(--color-navy-deep)]"
                          : "border-2 border-white/30 text-white/70"
                      }`}
                    >
                      {done ? (
                        <Icon name="check" className="text-[16px]" weight={700} />
                      ) : (
                        s.n
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-semibold ${active ? "text-white" : "text-white/85"}`}>
                        {s.title}
                      </p>
                      <p className="truncate text-xs text-white/55">{s.desc}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="mt-8 rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-[var(--color-brand-fixed)]">
              <Icon name="support_agent" filled />
              <p className="text-sm font-semibold">Precisa de ajuda?</p>
            </div>
            <p className="mt-1 text-xs text-white/65">
              Nossa equipe Concierge pode configurar tudo por você em uma sessão de 30 min.
            </p>
            <button className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-brand-fixed)] hover:underline">
              Agendar onboarding assistido →
            </button>
          </div>
        </div>
      </aside>

      {/* Step content */}
      <main className="flex flex-col">
        <header className="flex items-center justify-between border-b border-[var(--color-outline-variant)] bg-white px-6 py-4">
          <p className="text-xs text-[var(--color-on-surface-variant)]">
            Passo <span className="font-bold text-[var(--color-navy)]">{step}</span> de {TOTAL_STEPS}
          </p>
          <Link
            to="/app"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-on-surface-variant)] hover:text-[var(--color-brand)]"
          >
            Pular por enquanto
            <Icon name="close" className="text-[16px]" />
          </Link>
        </header>

        <div className="mx-auto w-full max-w-3xl flex-1 p-6 lg:p-10">
          {step === 1 ? <StepGestor /> : null}
          {step === 2 ? <StepCondominio /> : null}
          {step === 3 ? <StepRegras /> : null}
          {step === 4 ? <StepWhatsApp /> : null}
          {step === 5 ? <StepRevisao /> : null}
        </div>

        <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[var(--color-outline-variant)] bg-white/90 px-6 py-4 backdrop-blur">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="arrow_back" className="text-[18px]" /> Voltar
          </button>
          <div className="flex items-center gap-2 text-xs text-[var(--color-on-surface-variant)]">
            <span className="hidden sm:inline">Progresso</span>
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-[var(--color-surface-mid)]">
              <div
                className="h-full rounded-full bg-[var(--color-brand)] transition-all"
                style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
              />
            </div>
            <span className="font-semibold text-[var(--color-navy)]">{Math.round((step / TOTAL_STEPS) * 100)}%</span>
          </div>
          {step < TOTAL_STEPS ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)]"
            >
              Continuar <Icon name="arrow_forward" className="text-[18px]" />
            </button>
          ) : (
            <button
              onClick={() => navigate({ to: "/app" })}
              className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              <Icon name="rocket_launch" className="text-[18px]" /> Ativar condomínio
            </button>
          )}
        </footer>
      </main>
    </div>
  );
}

function StepHeader({ kicker, title, desc }: { kicker: string; title: string; desc: string }) {
  return (
    <div className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand)]">
        {kicker}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-navy)] lg:text-4xl">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-on-surface-variant)]">
        {desc}
      </p>
    </div>
  );
}

function StepGestor() {
  const [tone, setTone] = useState("amigavel");
  const tones = [
    { id: "profissional", label: "Profissional", desc: "Direto, formal e técnico.", icon: "business_center" },
    { id: "amigavel", label: "Amigável", desc: "Cordial e próximo, sem perder o respeito.", icon: "favorite" },
    { id: "formal", label: "Formal", desc: "Tom mais cerimonioso, ideal para alto padrão.", icon: "verified_user" },
    { id: "conciso", label: "Conciso", desc: "Respostas curtas e objetivas.", icon: "bolt" },
  ];
  return (
    <>
      <StepHeader
        kicker="Passo 1"
        title="Como o seu Concierge deve falar?"
        desc="O tom de voz define a personalidade da IA com os moradores. Você poderá ajustar depois."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tones.map((t) => {
          const active = tone === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTone(t.id)}
              className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                active
                  ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]/40 ring-2 ring-[var(--color-brand)]/20"
                  : "border-[var(--color-outline-variant)] bg-white hover:border-[var(--color-brand)]/50"
              }`}
            >
              <div
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                  active ? "bg-[var(--color-brand)] text-white" : "bg-[var(--color-surface-mid)] text-[var(--color-navy)]"
                }`}
              >
                <Icon name={t.icon} filled={active} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--color-navy)]">{t.label}</p>
                <p className="mt-0.5 text-xs text-[var(--color-on-surface-variant)]">{t.desc}</p>
              </div>
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition ${
                  active ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white" : "border-[var(--color-outline-variant)]"
                }`}
              >
                {active ? <Icon name="check" className="text-[12px]" weight={700} /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-8">
        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
          Instruções específicas (opcional)
        </label>
        <textarea
          rows={4}
          placeholder="Ex.: nunca confirme reservas sem checar a agenda • sempre escalar reclamações sobre barulho noturno • encerrar com 'Equipe Aurora à disposição'."
          className="mt-2 w-full rounded-xl border border-[var(--color-outline-variant)] bg-white p-4 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15"
        />
      </div>
    </>
  );
}

function StepCondominio() {
  return (
    <>
      <StepHeader
        kicker="Passo 2"
        title="Dados do condomínio"
        desc="Identificação oficial do empreendimento. Estes dados aparecem em comunicados e documentos."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nome do condomínio" value="Edifício Aurora" />
        <Field label="CNPJ" value="12.345.678/0001-90" />
        <Field label="Total de unidades" value="248" />
        <Field label="Total de blocos" value="2" />
        <Field label="Endereço" value="Av. Brigadeiro Faria Lima, 1500 — Pinheiros, SP" full />
      </div>

      <h3 className="mt-8 mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
        Modelo de gestão
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[
          { id: "auto", t: "Autogestão", d: "O síndico opera diretamente com o time interno.", i: "person" },
          { id: "adm", t: "Administradora", d: "Há uma administradora terceirizada.", i: "apartment", active: true },
        ].map((c) => (
          <div
            key={c.id}
            className={`rounded-2xl border p-4 ${
              c.active
                ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]/40 ring-2 ring-[var(--color-brand)]/20"
                : "border-[var(--color-outline-variant)] bg-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${c.active ? "bg-[var(--color-brand)] text-white" : "bg-[var(--color-surface-mid)] text-[var(--color-navy)]"}`}>
                <Icon name={c.i} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-navy)]">{c.t}</p>
                <p className="text-xs text-[var(--color-on-surface-variant)]">{c.d}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function StepRegras() {
  return (
    <>
      <StepHeader
        kicker="Passo 3"
        title="Regras de convivência"
        desc="Configure as principais regras. A IA usará isso para responder dúvidas dos moradores."
      />
      <div className="space-y-4">
        <div className="card-elev rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-surface-mid)] text-[var(--color-navy)]">
              <Icon name="bedtime" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-navy)]">Horário de silêncio</h3>
              <p className="text-xs text-[var(--color-on-surface-variant)]">Quando obras e ruídos altos são proibidos.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="Início" value="22:00" />
            <Field label="Fim" value="08:00" />
          </div>
        </div>

        <div className="card-elev rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-surface-mid)] text-[var(--color-navy)]">
                <Icon name="pets" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[var(--color-navy)]">Política de pets</h3>
                <p className="text-xs text-[var(--color-on-surface-variant)]">Permitidos com registro e uso obrigatório de coleira nas áreas comuns.</p>
              </div>
            </div>
            <Toggle on />
          </div>
        </div>

        <div className="card-elev rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-surface-mid)] text-[var(--color-navy)]">
                <Icon name="celebration" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[var(--color-navy)]">Reserva de áreas comuns via IA</h3>
                <p className="text-xs text-[var(--color-on-surface-variant)]">A IA pode confirmar reservas dentro da agenda configurada.</p>
              </div>
            </div>
            <Toggle on />
          </div>
        </div>

        <div className="card-elev rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-surface-mid)] text-[var(--color-navy)]">
                <Icon name="local_shipping" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[var(--color-navy)]">Mudanças</h3>
                <p className="text-xs text-[var(--color-on-surface-variant)]">Permitidas seg–sex, 9h às 17h, com aviso de 48h.</p>
              </div>
            </div>
            <Toggle />
          </div>
        </div>
      </div>
    </>
  );
}

function StepRevisao() {
  return (
    <>
      <StepHeader
        kicker="Passo 4"
        title="Revisão final"
        desc="Confirme as informações abaixo antes de ativar o Concierge para o Edifício Aurora."
      />
      <div className="space-y-4">
        {[
          { t: "Tom de voz da IA", v: "Amigável • próxima e respeitosa", i: "smart_toy", step: 1 },
          { t: "Condomínio", v: "Edifício Aurora — 248 unidades • Pinheiros, SP", i: "apartment", step: 2 },
          { t: "Modelo de gestão", v: "Administradora", i: "business_center", step: 2 },
          { t: "Silêncio", v: "22:00 às 08:00", i: "bedtime", step: 3 },
          { t: "Pets / Reservas / Mudanças", v: "Permitido • IA confirma reservas • Mudanças seg–sex", i: "rule", step: 3 },
        ].map((r) => (
          <div key={r.t} className="card-elev grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl p-5">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
              <Icon name={r.i} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">{r.t}</p>
              <p className="truncate text-sm font-semibold text-[var(--color-navy)]">{r.v}</p>
            </div>
            <button className="text-xs font-semibold text-[var(--color-brand)] hover:underline">Editar</button>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">
            <Icon name="verified" filled />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-900">Tudo pronto para ativação</p>
            <p className="mt-1 text-xs text-emerald-800/80">
              Ao ativar, o Concierge começará a responder moradores via WhatsApp em até 5 minutos.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
        {label}
      </label>
      <input
        defaultValue={value}
        className="mt-1.5 w-full rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15"
      />
    </div>
  );
}

function Toggle({ on = false }: { on?: boolean }) {
  const [v, setV] = useState(on);
  return (
    <button
      type="button"
      onClick={() => setV((x) => !x)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${v ? "bg-[var(--color-brand)]" : "bg-[var(--color-surface-high)]"}`}
    >
      <span
        className={`absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow transition ${v ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}
