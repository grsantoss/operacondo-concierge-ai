import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";

export const Route = createFileRoute("/app/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações | Concierge OperaCondo" },
      {
        name: "description",
        content:
          "Ajuste perfil, condomínio, comportamento da IA, notificações, integrações e segurança do OperaCondo.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

type TabId =
  | "perfil"
  | "condominio"
  | "agente"
  | "notificacoes"
  | "integracoes"
  | "aparencia"
  | "seguranca";

interface TabDef {
  id: TabId;
  label: string;
  icon: string;
  hint: string;
}

const TABS: TabDef[] = [
  { id: "perfil", label: "Perfil", icon: "person", hint: "Seus dados e preferências" },
  { id: "condominio", label: "Condomínio", icon: "apartment", hint: "Dados institucionais" },
  { id: "agente", label: "Agente IA", icon: "smart_toy", hint: "Tom, escopo e limites" },
  { id: "notificacoes", label: "Notificações", icon: "notifications", hint: "Alertas e canais" },
  { id: "integracoes", label: "Integrações", icon: "hub", hint: "WhatsApp, e-mail, ERP" },
  { id: "aparencia", label: "Aparência", icon: "palette", hint: "Tema e densidade" },
  { id: "seguranca", label: "Segurança", icon: "lock", hint: "Senha e sessões" },
];

function ConfiguracoesPage() {
  const [tab, setTab] = useState<TabId>("perfil");
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  }

  return (
    <AppShell title="Configurações">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6 flex flex-col gap-2 md:mb-8">
          <div className="flex items-center gap-2 text-xs text-[var(--color-on-surface-variant)]">
            <Icon name="settings" className="text-[16px]" />
            <span>Configurações</span>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-on-surface)] md:text-3xl">
            Ajuste o Concierge do seu jeito
          </h1>
          <p className="max-w-2xl text-sm text-[var(--color-on-surface-variant)]">
            Personalize seu perfil, o comportamento do agente e os canais que ele usa para
            atender moradores.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <nav
            aria-label="Seções de configuração"
            className="flex gap-2 overflow-x-auto rounded-2xl border border-[var(--color-outline-variant)] bg-white p-2 md:sticky md:top-4 md:h-max md:flex-col md:overflow-visible"
          >
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition md:w-full ${
                    active
                      ? "bg-[var(--color-navy-deep)] text-white"
                      : "text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]"
                  }`}
                >
                  <Icon name={t.icon} className="text-[20px] shrink-0" />
                  <span className="flex flex-col">
                    <span>{t.label}</span>
                    <span
                      className={`hidden text-[11px] font-normal md:block ${
                        active ? "text-white/60" : "text-[var(--color-on-surface-variant)]"
                      }`}
                    >
                      {t.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          <section className="min-w-0">
            {tab === "perfil" && <PerfilPanel onSave={() => showToast("Perfil atualizado")} />}
            {tab === "condominio" && (
              <CondominioPanel onSave={() => showToast("Dados do condomínio salvos")} />
            )}
            {tab === "agente" && <AgentePanel onSave={() => showToast("Comportamento da IA atualizado")} />}
            {tab === "notificacoes" && (
              <NotificacoesPanel onSave={() => showToast("Preferências de notificação salvas")} />
            )}
            {tab === "integracoes" && (
              <IntegracoesPanel onToast={(m) => showToast(m)} />
            )}
            {tab === "aparencia" && (
              <AparenciaPanel onSave={() => showToast("Aparência atualizada")} />
            )}
            {tab === "seguranca" && (
              <SegurancaPanel onToast={(m) => showToast(m)} />
            )}
          </section>
        </div>
      </div>

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-[var(--color-navy-deep)] px-4 py-2 text-sm font-medium text-white shadow-lg">
            <Icon name="check_circle" className="text-[18px]" />
            {toast}
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

/* ---------- Shared UI helpers ---------- */

function Card({
  title,
  desc,
  children,
  footer,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-[var(--color-outline-variant)] bg-white">
      <div className="border-b border-[var(--color-outline-variant)] px-5 py-4">
        <h2 className="text-base font-semibold text-[var(--color-on-surface)]">{title}</h2>
        {desc ? (
          <p className="mt-0.5 text-xs text-[var(--color-on-surface-variant)]">{desc}</p>
        ) : null}
      </div>
      <div className="px-5 py-5">{children}</div>
      {footer ? (
        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-5 py-3">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-on-surface-variant)]">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="text-[11px] text-[var(--color-on-surface-variant)]">{hint}</span>
      ) : null}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 py-2 text-sm text-[var(--color-on-surface)] outline-none transition focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20";

function Toggle({
  checked,
  onChange,
  label,
  desc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--color-on-surface)]">{label}</p>
        {desc ? (
          <p className="text-xs text-[var(--color-on-surface-variant)]">{desc}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-[var(--color-brand)]" : "bg-[var(--color-outline-variant)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function PrimaryBtn({
  children,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-navy-deep)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
    >
      {children}
    </button>
  );
}

function GhostBtn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-on-surface)] transition hover:bg-[var(--color-surface-container)]"
    >
      {children}
    </button>
  );
}

/* ---------- Panels ---------- */

function PerfilPanel({ onSave }: { onSave: () => void }) {
  const [nome, setNome] = useState("Roberto Silva");
  const [email, setEmail] = useState("roberto.silva@edificioaurora.com.br");
  const [telefone, setTelefone] = useState("+55 11 98765-4321");
  const [cargo, setCargo] = useState("Síndico");
  const [bio, setBio] = useState(
    "Síndico do Edifício Aurora há 3 anos. Foco em transparência e agilidade nas demandas.",
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <Card
        title="Dados pessoais"
        desc="Como você aparece para moradores e prestadores."
        footer={<PrimaryBtn type="submit">Salvar alterações</PrimaryBtn>}
      >
        <div className="mb-5 flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-hover)] text-lg font-bold text-white">
            RS
          </div>
          <div className="flex flex-col gap-2">
            <GhostBtn onClick={() => onSave()}>
              <Icon name="upload" className="text-[16px]" /> Trocar foto
            </GhostBtn>
            <p className="text-[11px] text-[var(--color-on-surface-variant)]">
              PNG ou JPG, até 2MB.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome completo">
            <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <Field label="Cargo">
            <select className={inputCls} value={cargo} onChange={(e) => setCargo(e.target.value)}>
              <option>Síndico</option>
              <option>Subsíndico</option>
              <option>Conselheiro</option>
              <option>Zelador</option>
              <option>Administrador</option>
            </select>
          </Field>
          <Field label="E-mail">
            <input
              type="email"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Telefone">
            <input
              className={inputCls}
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Bio curta" hint="Aparece no perfil público para moradores.">
              <textarea
                className={`${inputCls} min-h-[88px] resize-y`}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </Field>
          </div>
        </div>
      </Card>
    </form>
  );
}

function CondominioPanel({ onSave }: { onSave: () => void }) {
  const [nome, setNome] = useState("Edifício Aurora");
  const [cnpj, setCnpj] = useState("12.345.678/0001-90");
  const [endereco, setEndereco] = useState("Rua das Palmeiras, 250 - Jardins, São Paulo/SP");
  const [unidades, setUnidades] = useState("84");
  const [horario, setHorario] = useState("Seg-Sex, 8h às 18h");
  const [emergencia, setEmergencia] = useState("+55 11 3000-1111");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <Card
        title="Identidade do condomínio"
        desc="Usado em documentos, respostas do agente e comunicações."
        footer={<PrimaryBtn type="submit">Salvar</PrimaryBtn>}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome">
            <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <Field label="CNPJ">
            <input className={inputCls} value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Endereço">
              <input
                className={inputCls}
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Unidades">
            <input
              type="number"
              className={inputCls}
              value={unidades}
              onChange={(e) => setUnidades(e.target.value)}
            />
          </Field>
          <Field label="Horário do síndico">
            <input
              className={inputCls}
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
            />
          </Field>
          <Field label="Telefone de emergência 24h">
            <input
              className={inputCls}
              value={emergencia}
              onChange={(e) => setEmergencia(e.target.value)}
            />
          </Field>
        </div>
      </Card>
    </form>
  );
}

function AgentePanel({ onSave }: { onSave: () => void }) {
  const [tom, setTom] = useState<"Formal" | "Cordial" | "Casual">("Cordial");
  const [autonomia, setAutonomia] = useState(60);
  const [assumir, setAssumir] = useState(true);
  const [reservas, setReservas] = useState(true);
  const [orcamentos, setOrcamentos] = useState(false);
  const [horario, setHorario] = useState(true);
  const [assinatura, setAssinatura] = useState(
    "— Concierge OperaCondo, ao lado de Roberto Silva",
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <Card
        title="Personalidade"
        desc="Como o agente se comunica com os moradores."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tom de voz">
            <div className="flex gap-2">
              {(["Formal", "Cordial", "Casual"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTom(t)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    tom === t
                      ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                      : "border-[var(--color-outline-variant)] bg-white text-[var(--color-on-surface)]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Field
            label={`Autonomia da IA (${autonomia}%)`}
            hint="Quanto maior, menos vezes o síndico é consultado."
          >
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={autonomia}
              onChange={(e) => setAutonomia(Number(e.target.value))}
              className="w-full accent-[var(--color-brand)]"
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Assinatura padrão nas mensagens">
              <input
                className={inputCls}
                value={assinatura}
                onChange={(e) => setAssinatura(e.target.value)}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card
        title="O que a IA pode resolver sozinha"
        footer={<PrimaryBtn type="submit">Salvar comportamento</PrimaryBtn>}
      >
        <Toggle
          checked={reservas}
          onChange={setReservas}
          label="Confirmar reservas de áreas comuns"
          desc="Dentro da agenda configurada, sem consultar o síndico."
        />
        <Toggle
          checked={horario}
          onChange={setHorario}
          label="Responder dúvidas sobre horários e regras"
          desc="Baseado na Base de Conhecimento."
        />
        <Toggle
          checked={orcamentos}
          onChange={setOrcamentos}
          label="Solicitar orçamentos a fornecedores"
          desc="A IA cota até 3 fornecedores homologados por conta própria."
        />
        <Toggle
          checked={assumir}
          onChange={setAssumir}
          label="Escalar automaticamente para o síndico"
          desc="Quando um morador demonstra insatisfação ou é urgência."
        />
      </Card>
    </form>
  );
}

function NotificacoesPanel({ onSave }: { onSave: () => void }) {
  const [emailNew, setEmailNew] = useState(true);
  const [emailResumo, setEmailResumo] = useState(true);
  const [pushUrg, setPushUrg] = useState(true);
  const [pushMenc, setPushMenc] = useState(false);
  const [whats, setWhats] = useState(true);
  const [horario, setHorario] = useState("silencioso");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <Card title="E-mail">
        <Toggle
          checked={emailNew}
          onChange={setEmailNew}
          label="Nova demanda aguardando síndico"
        />
        <Toggle
          checked={emailResumo}
          onChange={setEmailResumo}
          label="Resumo diário às 18h"
          desc="O que a IA resolveu, o que ficou pendente."
        />
      </Card>

      <Card title="Push (app)">
        <Toggle
          checked={pushUrg}
          onChange={setPushUrg}
          label="Alertas urgentes (vazamento, elevador, segurança)"
        />
        <Toggle
          checked={pushMenc}
          onChange={setPushMenc}
          label="Quando um morador me menciona diretamente"
        />
      </Card>

      <Card
        title="WhatsApp e horário silencioso"
        footer={<PrimaryBtn type="submit">Salvar</PrimaryBtn>}
      >
        <Toggle
          checked={whats}
          onChange={setWhats}
          label="Receber notificações críticas no WhatsApp"
        />
        <div className="mt-4">
          <Field
            label="Horário silencioso"
            hint="Notificações não urgentes ficam retidas nesse intervalo."
          >
            <select
              className={inputCls}
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
            >
              <option value="off">Desativado</option>
              <option value="silencioso">22h às 7h</option>
              <option value="fds">Sábado e domingo</option>
              <option value="ambos">22h às 7h + finais de semana</option>
            </select>
          </Field>
        </div>
      </Card>
    </form>
  );
}

function IntegracoesPanel({ onToast }: { onToast: (m: string) => void }) {
  const [integrations, setIntegrations] = useState([
    {
      id: "whatsapp",
      name: "WhatsApp Business",
      desc: "Canal principal de conversa com moradores.",
      icon: "chat",
      connected: true,
    },
    {
      id: "email",
      name: "E-mail (SMTP)",
      desc: "Envio de comunicados e boletos.",
      icon: "mail",
      connected: true,
    },
    {
      id: "erp",
      name: "ERP administrativo",
      desc: "Sincroniza inadimplência e boletos.",
      icon: "sync_alt",
      connected: false,
    },
    {
      id: "gcal",
      name: "Google Calendar",
      desc: "Publica reservas de áreas comuns.",
      icon: "calendar_month",
      connected: false,
    },
    {
      id: "portaria",
      name: "Sistema de portaria",
      desc: "Encomendas, visitantes e liberações.",
      icon: "meeting_room",
      connected: false,
    },
  ]);

  function toggle(id: string) {
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, connected: !i.connected } : i)),
    );
    const item = integrations.find((i) => i.id === id);
    onToast(item?.connected ? `${item.name} desconectado` : `${item?.name} conectado`);
  }

  return (
    <Card title="Integrações" desc="Conecte serviços que o Concierge usa para operar.">
      <ul className="divide-y divide-[var(--color-outline-variant)]">
        {integrations.map((i) => (
          <li key={i.id} className="flex items-center gap-4 py-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-container)]">
              <Icon name={i.icon} className="text-[20px] text-[var(--color-navy-deep)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--color-on-surface)]">
                {i.name}
              </p>
              <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
                {i.desc}
              </p>
            </div>
            <span
              className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold md:inline-block ${
                i.connected
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]"
              }`}
            >
              {i.connected ? "Conectado" : "Desconectado"}
            </span>
            <button
              type="button"
              onClick={() => toggle(i.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                i.connected
                  ? "border border-[var(--color-outline-variant)] bg-white text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]"
                  : "bg-[var(--color-navy-deep)] text-white hover:opacity-90"
              }`}
            >
              {i.connected ? "Desconectar" : "Conectar"}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AparenciaPanel({ onSave }: { onSave: () => void }) {
  const [tema, setTema] = useState<"claro" | "escuro" | "auto">("claro");
  const [densidade, setDensidade] = useState<"confortavel" | "compacto">("confortavel");
  const [idioma, setIdioma] = useState("pt-BR");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <Card title="Aparência" footer={<PrimaryBtn type="submit">Salvar</PrimaryBtn>}>
        <Field label="Tema">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "claro", label: "Claro", icon: "light_mode" },
                { id: "escuro", label: "Escuro", icon: "dark_mode" },
                { id: "auto", label: "Sistema", icon: "contrast" },
              ] as const
            ).map((op) => (
              <button
                key={op.id}
                type="button"
                onClick={() => setTema(op.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-3 py-4 text-sm font-medium transition ${
                  tema === op.id
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                    : "border-[var(--color-outline-variant)] bg-white text-[var(--color-on-surface)]"
                }`}
              >
                <Icon name={op.icon} className="text-[22px]" />
                {op.label}
              </button>
            ))}
          </div>
        </Field>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Densidade">
            <select
              className={inputCls}
              value={densidade}
              onChange={(e) => setDensidade(e.target.value as "confortavel" | "compacto")}
            >
              <option value="confortavel">Confortável</option>
              <option value="compacto">Compacto</option>
            </select>
          </Field>
          <Field label="Idioma">
            <select
              className={inputCls}
              value={idioma}
              onChange={(e) => setIdioma(e.target.value)}
            >
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">English (US)</option>
              <option value="es-ES">Español</option>
            </select>
          </Field>
        </div>
      </Card>
    </form>
  );
}

function SegurancaPanel({ onToast }: { onToast: (m: string) => void }) {
  const [twofa, setTwofa] = useState(true);
  const [alertLogin, setAlertLogin] = useState(true);
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [conf, setConf] = useState("");

  const sessoes = [
    { id: "s1", device: "MacBook Pro • Chrome", where: "São Paulo, BR", last: "agora" },
    { id: "s2", device: "iPhone 15 • App", where: "São Paulo, BR", last: "há 12 min" },
    { id: "s3", device: "Chrome • Windows", where: "Campinas, BR", last: "há 3 dias" },
  ];

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!nova || nova !== conf) {
            onToast("As senhas não conferem");
            return;
          }
          setAtual("");
          setNova("");
          setConf("");
          onToast("Senha alterada");
        }}
      >
        <Card
          title="Alterar senha"
          footer={<PrimaryBtn type="submit">Atualizar senha</PrimaryBtn>}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Senha atual">
              <input
                type="password"
                className={inputCls}
                value={atual}
                onChange={(e) => setAtual(e.target.value)}
              />
            </Field>
            <Field label="Nova senha">
              <input
                type="password"
                className={inputCls}
                value={nova}
                onChange={(e) => setNova(e.target.value)}
              />
            </Field>
            <Field label="Confirmar nova senha">
              <input
                type="password"
                className={inputCls}
                value={conf}
                onChange={(e) => setConf(e.target.value)}
              />
            </Field>
          </div>
        </Card>
      </form>

      <Card title="Autenticação e alertas">
        <Toggle
          checked={twofa}
          onChange={(v) => {
            setTwofa(v);
            onToast(v ? "2FA ativado" : "2FA desativado");
          }}
          label="Verificação em duas etapas"
          desc="Código enviado ao seu WhatsApp em novos dispositivos."
        />
        <Toggle
          checked={alertLogin}
          onChange={setAlertLogin}
          label="Avisar-me sobre novos logins"
        />
      </Card>

      <Card title="Sessões ativas">
        <ul className="divide-y divide-[var(--color-outline-variant)]">
          {sessoes.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-container)]">
                <Icon name="devices" className="text-[18px] text-[var(--color-navy-deep)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--color-on-surface)]">
                  {s.device}
                </p>
                <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
                  {s.where} • {s.last}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onToast("Sessão encerrada")}
                className="shrink-0 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]"
              >
                Encerrar
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Zona de risco">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <div>
            <p className="text-sm font-semibold text-red-700">Excluir conta</p>
            <p className="text-xs text-red-600/80">
              Remove seu acesso permanentemente. Os dados do condomínio permanecem.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onToast("Fale com o suporte para excluir a conta")}
            className="shrink-0 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
          >
            Excluir
          </button>
        </div>
      </Card>
    </>
  );
}
