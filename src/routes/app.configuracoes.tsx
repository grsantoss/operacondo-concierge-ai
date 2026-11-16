import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";
import { configAgenteQuery, useSalvarConfigAgente } from "@/data/agente";
import { condominiosQuery, useCondominios } from "@/data/moradores";
import type { ConfigAgente } from "@/lib/agente.functions";

export const Route = createFileRoute("/app/configuracoes")({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(condominiosQuery),
  head: () => ({
    meta: [
      { title: "Configurações | OperaCondo Concierge" },
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
  | "corporativo"
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
  { id: "corporativo", label: "Dados corporativos", icon: "business", hint: "CNPJ, razão social, endereço" },
  { id: "agente", label: "Agente IA", icon: "smart_toy", hint: "Tom, escopo e limites" },
  { id: "notificacoes", label: "Notificações", icon: "notifications", hint: "Alertas e canais" },
  { id: "integracoes", label: "Integrações", icon: "hub", hint: "WhatsApp, e-mail, ERP" },
  { id: "aparencia", label: "Aparência", icon: "palette", hint: "Densidade e idioma" },
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
            {tab === "corporativo" && (
              <CorporativoPanel onSave={() => showToast("Dados corporativos salvos")} />
            )}
            {tab === "agente" && <AgentePanel onSave={showToast} />}
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
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-[var(--color-navy-deep)] px-4 py-2 text-sm font-medium text-white shadow-elevated">
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
        aria-label={label}
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
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-navy-deep)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
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

function CorporativoPanel({ onSave }: { onSave: () => void }) {
  const [razaoSocial, setRazaoSocial] = useState("Condomínio Edifício Aurora");
  const [nomeFantasia, setNomeFantasia] = useState("Edifício Aurora");
  const [cnpj, setCnpj] = useState("12.345.678/0001-90");
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState("");
  const [email, setEmail] = useState("contato@edificioaurora.com.br");
  const [telefone, setTelefone] = useState("+55 11 3000-1000");

  const [cep, setCep] = useState("01452-000");
  const [logradouro, setLogradouro] = useState("Rua das Palmeiras");
  const [numero, setNumero] = useState("250");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("Jardins");
  const [cidade, setCidade] = useState("São Paulo");
  const [uf, setUf] = useState("SP");

  const [responsavel, setResponsavel] = useState("Roberto Silva");
  const [cargo, setCargo] = useState("Síndico profissional");
  const [horario, setHorario] = useState("Seg-Sex, 8h às 18h");
  const [emergencia, setEmergencia] = useState("+55 11 3000-1111");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      className="space-y-6"
    >
      <Card
        title="Dados corporativos"
        desc="Informações jurídicas usadas em contratos, notas fiscais e comunicações oficiais."
        footer={<PrimaryBtn type="submit">Salvar</PrimaryBtn>}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Razão social">
              <input
                className={inputCls}
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Nome fantasia">
            <input
              className={inputCls}
              value={nomeFantasia}
              onChange={(e) => setNomeFantasia(e.target.value)}
            />
          </Field>
          <Field label="CNPJ">
            <input
              className={inputCls}
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </Field>
          <Field label="Inscrição municipal" hint="Opcional">
            <input
              className={inputCls}
              value={inscricaoMunicipal}
              onChange={(e) => setInscricaoMunicipal(e.target.value)}
            />
          </Field>
          <Field label="E-mail institucional">
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
          <Field label="Telefone de emergência 24h">
            <input
              className={inputCls}
              value={emergencia}
              onChange={(e) => setEmergencia(e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card title="Endereço" desc="Endereço fiscal e de correspondência.">
        <div className="grid gap-4 md:grid-cols-6">
          <div className="md:col-span-2">
            <Field label="CEP">
              <input
                className={inputCls}
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                placeholder="00000-000"
              />
            </Field>
          </div>
          <div className="md:col-span-4">
            <Field label="Logradouro">
              <input
                className={inputCls}
                value={logradouro}
                onChange={(e) => setLogradouro(e.target.value)}
              />
            </Field>
          </div>
          <div className="md:col-span-1">
            <Field label="Número">
              <input
                className={inputCls}
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field label="Complemento">
              <input
                className={inputCls}
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Bairro">
              <input
                className={inputCls}
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
              />
            </Field>
          </div>
          <div className="md:col-span-4">
            <Field label="Cidade">
              <input
                className={inputCls}
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="UF">
              <input
                className={inputCls}
                value={uf}
                onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Responsável legal" desc="Representante que responde pela pessoa jurídica.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome do responsável">
            <input
              className={inputCls}
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
            />
          </Field>
          <Field label="Cargo">
            <input
              className={inputCls}
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Horário de atendimento">
              <input
                className={inputCls}
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
              />
            </Field>
          </div>
        </div>
      </Card>
    </form>
  );
}


function AgentePanel({ onSave }: { onSave: (msg: string) => void }) {
  const condominios = useCondominios();
  const [condoId, setCondoId] = useState(condominios[0]?.id ?? "");
  const { data } = useQuery({ ...configAgenteQuery(condoId), enabled: !!condoId });

  if (!condominios.length)
    return (
      <Card title="Agente IA" desc="Cadastre um condomínio para configurar o agente.">
        <p className="text-sm text-[var(--color-on-surface-variant)]">Nenhum condomínio ainda.</p>
      </Card>
    );

  return (
    <div>
      <Card
        title="Condomínio"
        desc="Cada condomínio tem a sua configuração do agente."
      >
        <select
          aria-label="Condomínio"
          className={inputCls}
          value={condoId}
          onChange={(e) => setCondoId(e.target.value)}
        >
          {condominios.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </Card>
      {data ? (
        // key: troca de condomínio recomeça o formulário com os dados dele
        <AgenteForm key={condoId} condominioId={condoId} inicial={data} onSave={onSave} />
      ) : (
        <p className="p-4 text-sm text-[var(--color-on-surface-variant)]">Carregando…</p>
      )}
    </div>
  );
}

const TONS = [
  { id: "formal", label: "Formal" },
  { id: "cordial", label: "Cordial" },
  { id: "direto", label: "Direto" },
] as const;

function AgenteForm({
  condominioId,
  inicial,
  onSave,
}: {
  condominioId: string;
  inicial: ConfigAgente;
  onSave: (msg: string) => void;
}) {
  const [cfg, setCfg] = useState(inicial);
  const [limite, setLimite] = useState(inicial.limiteAprovacao?.toString() ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const salvar = useSalvarConfigAgente();
  const op = cfg.opcoes;
  const setOp = (patch: Partial<ConfigAgente["opcoes"]>) =>
    setCfg((c) => ({ ...c, opcoes: { ...c.opcoes, ...patch } }));
  const setRecl = (patch: Partial<ConfigAgente["opcoes"]["reclamacoes"]>) =>
    setOp({ reclamacoes: { ...op.reclamacoes, ...patch } });
  const setMan = (patch: Partial<ConfigAgente["opcoes"]["manutencao"]>) =>
    setOp({ manutencao: { ...op.manutencao, ...patch } });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = limite.trim() ? Number(limite.replace(/\./g, "").replace(",", ".")) : null;
    if (n !== null && (Number.isNaN(n) || n < 0)) return setErro("Limite de aprovação inválido.");
    setErro(null);
    setSalvando(true);
    try {
      await salvar(condominioId, { ...cfg, limiteAprovacao: n });
      onSave("Comportamento da IA salvo");
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Card title="Personalidade" desc="Como o agente se comunica com os moradores.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tom de voz">
            <div className="flex gap-2">
              {TONS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={cfg.tom === t.id}
                  onClick={() => setCfg((c) => ({ ...c, tom: t.id }))}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    cfg.tom === t.id
                      ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                      : "border-[var(--color-outline-variant)] bg-white text-[var(--color-on-surface)]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Quando o síndico é consultado">
            <p className="flex gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] px-3 py-2 text-xs text-[var(--color-on-surface-variant)]">
              <Icon name="gavel" className="mt-0.5 text-[14px] text-[var(--color-brand)]" />
              <span>
                A IA responde sozinha quando encontra a regra na convenção, estatuto, regimento ou
                atas, e cita o artigo. Sem base nos documentos, a conversa vai para você com um
                rascunho de resposta para aprovar.
              </span>
            </p>
          </Field>
          <div className="md:col-span-2">
            <Field label="Assinatura padrão nas mensagens">
              <input
                className={inputCls}
                maxLength={120}
                value={op.assinatura}
                onChange={(e) => setOp({ assinatura: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="O que a IA pode resolver sozinha">
        <Toggle
          checked={op.reservas}
          onChange={(v) => setOp({ reservas: v })}
          label="Confirmar reservas de áreas comuns"
          desc="Dentro da agenda configurada, sem consultar o síndico."
        />
        <Toggle
          checked={op.horarios}
          onChange={(v) => setOp({ horarios: v })}
          label="Responder dúvidas sobre horários e regras"
          desc="Baseado na Base de Conhecimento."
        />
        <Toggle
          checked={op.orcamentos}
          onChange={(v) => setOp({ orcamentos: v })}
          label="Solicitar orçamentos a fornecedores"
          desc="A IA cota até 3 fornecedores homologados por conta própria."
        />
        <Toggle
          checked={op.escalarAuto}
          onChange={(v) => setOp({ escalarAuto: v })}
          label="Escalar automaticamente para o síndico"
          desc="Quando um morador demonstra insatisfação ou é urgência."
        />
      </Card>

      <Card
        title="Regras para reclamações"
        desc="Como a IA registra e classifica reclamações (barulho, vizinhança, áreas comuns)."
      >
        <Toggle
          checked={op.reclamacoes.auto}
          onChange={(v) => setRecl({ auto: v })}
          label="IA registra e classifica reclamações automaticamente"
          desc="Categoriza por tipo e cria a demanda no Kanban."
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Prioridade padrão">
            <select
              className={inputCls}
              value={op.reclamacoes.prioridade}
              onChange={(e) =>
                setRecl({ prioridade: e.target.value as ConfigAgente["opcoes"]["reclamacoes"]["prioridade"] })
              }
            >
              <option>Normal</option>
              <option>Alta</option>
              <option>Crítica</option>
            </select>
          </Field>
          <Field label="Escalar para o síndico quando">
            <select
              className={inputCls}
              value={op.reclamacoes.escalar}
              onChange={(e) =>
                setRecl({ escalar: e.target.value as ConfigAgente["opcoes"]["reclamacoes"]["escalar"] })
              }
            >
              <option value="reincidente">Reincidente (3+ ocorrências)</option>
              <option value="outro_morador">Envolve outro morador</option>
              <option value="sempre">Sempre</option>
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Instruções extras para a IA">
              <textarea
                className={`${inputCls} min-h-[88px] resize-y`}
                maxLength={1000}
                placeholder="Ex.: barulho após 22h vai direto para triagem."
                value={op.reclamacoes.instrucoes}
                onChange={(e) => setRecl({ instrucoes: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card
        title="Abertura de chamado de manutenção"
        desc="Regras para como a IA abre e encaminha chamados de reparo."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Canal preferencial">
            <select
              className={inputCls}
              value={op.manutencao.canal}
              onChange={(e) =>
                setMan({ canal: e.target.value as ConfigAgente["opcoes"]["manutencao"]["canal"] })
              }
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="portal">Portal do morador</option>
              <option value="ambos">Ambos</option>
            </select>
          </Field>
          <Field label="Aprovação do síndico acima de (R$)">
            <input
              className={inputCls}
              inputMode="decimal"
              placeholder="Sem limite"
              value={limite}
              onChange={(e) => setLimite(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-2">
          <Toggle
            checked={op.manutencao.exigirFoto}
            onChange={(v) => setMan({ exigirFoto: v })}
            label="Exigir foto ou vídeo do problema"
            desc="A IA pede a mídia antes de abrir o chamado."
          />
          <Toggle
            checked={op.manutencao.aprovarAcimaLimite}
            onChange={(v) => setMan({ aprovarAcimaLimite: v })}
            label="Aprovação do síndico para orçamentos acima do limite"
          />
        </div>
        <div className="mt-4">
          <Field label="Instruções por especialidade">
            <textarea
              className={`${inputCls} min-h-[88px] resize-y`}
              maxLength={1000}
              placeholder="Ex.: hidráulica → pedir foto do local; elevadores → chamado imediato."
              value={op.manutencao.instrucoes}
              onChange={(e) => setMan({ instrucoes: e.target.value })}
            />
          </Field>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {erro ? (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        ) : null}
        <PrimaryBtn type="submit" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar comportamento"}
        </PrimaryBtn>
      </div>
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
    <>
      <WhatsAppIntegrationCard onToast={onToast} />

      <Card title="Outras integrações" desc="Conecte serviços que o Concierge usa para operar.">
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
                    ? "bg-success/10 text-success-strong"
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
    </>
  );
}

function WhatsAppIntegrationCard({ onToast }: { onToast: (m: string) => void }) {
  const [provider, setProvider] = useState<"zapi" | "meta">("zapi");
  const [status, setStatus] = useState<"idle" | "testing" | "connected">("connected");
  const [instanceId, setInstanceId] = useState("3AB1C-INSTANCIA");
  const [zapiToken, setZapiToken] = useState("••••••••••••");
  const [clientToken, setClientToken] = useState("");
  const [phoneId, setPhoneId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [metaToken, setMetaToken] = useState("");
  const [verifyToken, setVerifyToken] = useState("");

  function test() {
    setStatus("testing");
    onToast("Testando conexão…");
    window.setTimeout(() => {
      setStatus("connected");
      onToast("WhatsApp conectado");
    }, 1200);
  }

  function disconnect() {
    setStatus("idle");
    onToast("WhatsApp desconectado");
  }

  return (
    <Card
      title="WhatsApp"
      desc="Canal principal do Concierge. Conecte via Z-API ou API oficial da Meta."
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {(
            [
              { id: "zapi", label: "Z-API" },
              { id: "meta", label: "Meta Cloud API" },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProvider(p.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                provider === p.id
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                  : "border-[var(--color-outline-variant)] bg-white text-[var(--color-on-surface)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            status === "connected"
              ? "bg-success/10 text-success-strong"
              : status === "testing"
              ? "bg-amber-50 text-amber-700"
              : "bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === "connected"
                ? "bg-success"
                : status === "testing"
                ? "bg-warning animate-pulse"
                : "bg-muted-foreground"
            }`}
          />
          {status === "connected" ? "Conectado" : status === "testing" ? "Testando…" : "Não conectado"}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {provider === "zapi" ? (
          <>
            <Field label="Instance ID">
              <input className={inputCls} value={instanceId} onChange={(e) => setInstanceId(e.target.value)} />
            </Field>
            <Field label="Token">
              <input className={inputCls} value={zapiToken} onChange={(e) => setZapiToken(e.target.value)} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Client-Token (opcional)" hint="Obrigatório em contas com segurança avançada.">
                <input className={inputCls} value={clientToken} onChange={(e) => setClientToken(e.target.value)} />
              </Field>
            </div>
          </>
        ) : (
          <>
            <Field label="Phone Number ID">
              <input className={inputCls} value={phoneId} onChange={(e) => setPhoneId(e.target.value)} />
            </Field>
            <Field label="WhatsApp Business Account ID">
              <input className={inputCls} value={wabaId} onChange={(e) => setWabaId(e.target.value)} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Access Token permanente">
                <input className={inputCls} value={metaToken} onChange={(e) => setMetaToken(e.target.value)} />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Webhook Verify Token">
                <input className={inputCls} value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} />
              </Field>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <PrimaryBtn onClick={test}>
          <Icon name="bolt" className="text-[16px]" />
          {provider === "zapi" ? "Testar conexão" : "Validar credenciais"}
        </PrimaryBtn>
        <GhostBtn onClick={disconnect}>
          <Icon name="link_off" className="text-[16px]" /> Desconectar
        </GhostBtn>
        <a
          href={provider === "zapi" ? "https://z-api.io" : "https://developers.facebook.com/docs/whatsapp"}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]"
        >
          Como obter <Icon name="open_in_new" className="text-[14px]" />
        </a>
      </div>
    </Card>
  );
}

function AparenciaPanel({ onSave }: { onSave: () => void }) {
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
        <div className="grid gap-4 md:grid-cols-2">
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
        <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <div>
            <p className="text-sm font-semibold text-destructive">Excluir conta</p>
            <p className="text-xs text-destructive/80">
              Remove seu acesso permanentemente. Os dados do condomínio permanecem.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onToast("Fale com o suporte para excluir a conta")}
            className="shrink-0 rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-white hover:bg-destructive/90"
          >
            Excluir
          </button>
        </div>
      </Card>
    </>
  );
}
