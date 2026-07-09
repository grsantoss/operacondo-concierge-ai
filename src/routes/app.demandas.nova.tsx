import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";
import { CAT_ICON, PRIO_CLASS, type Category, type Priority } from "@/data/demandas";
import { CONDOMINIOS, MORADORES } from "@/data/moradores";

export const Route = createFileRoute("/app/demandas/nova")({
  head: () => ({ meta: [{ title: "Nova demanda | Concierge OperaCondo" }] }),
  component: NovaDemandaPage,
});

const CATEGORIAS: Category[] = ["Manutenção", "Segurança", "Limpeza", "Administrativo"];
const PRIORIDADES: Priority[] = ["Crítica", "Alta", "Normal"];
const CANAIS = ["WhatsApp", "Portal", "Portaria", "E-mail"] as const;

const SLA_POR_PRIORIDADE: Record<Priority, string> = {
  Crítica: "SLA 2h",
  Alta: "SLA 6h",
  Normal: "SLA 24h",
};

const schema = z.object({
  titulo: z.string().trim().min(4, "Descreva o assunto em ao menos 4 caracteres").max(120),
  descricao: z.string().trim().min(10, "Detalhe o ocorrido (mín. 10 caracteres)").max(1200),
  categoria: z.enum(["Manutenção", "Segurança", "Limpeza", "Administrativo"]),
  prioridade: z.enum(["Crítica", "Alta", "Normal"]),
  condominioId: z.string().min(1, "Selecione o condomínio"),
  moradorId: z.string().min(1, "Selecione o morador"),
  local: z.string().trim().min(3, "Informe o local afetado").max(120),
  canal: z.enum(CANAIS),
  custoEstimado: z.coerce.number().min(0, "Valor inválido"),
});

type FormState = {
  titulo: string;
  descricao: string;
  categoria: Category | "";
  prioridade: Priority;
  condominioId: string;
  moradorId: string;
  local: string;
  canal: (typeof CANAIS)[number];
  custoEstimado: string;
};

const INITIAL: FormState = {
  titulo: "",
  descricao: "",
  categoria: "",
  prioridade: "Normal",
  condominioId: "",
  moradorId: "",
  local: "",
  canal: "WhatsApp",
  custoEstimado: "0",
};

function NovaDemandaPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitted, setSubmitted] = useState(false);

  const moradoresFiltrados = useMemo(
    () =>
      form.condominioId
        ? MORADORES.filter((m) => m.condominioId === form.condominioId)
        : [],
    [form.condominioId],
  );

  const moradorSel = useMemo(
    () => MORADORES.find((m) => m.id === form.moradorId),
    [form.moradorId],
  );

  const completude = useMemo(() => {
    const req: (keyof FormState)[] = [
      "titulo",
      "descricao",
      "categoria",
      "condominioId",
      "moradorId",
      "local",
    ];
    const done = req.filter((k) => String(form[k]).trim().length > 0).length;
    return Math.round((done / req.length) * 100);
  }, [form]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function onCondominioChange(id: string) {
    setForm((f) => ({ ...f, condominioId: id, moradorId: "" }));
    if (errors.condominioId) setErrors((e) => ({ ...e, condominioId: undefined }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FormState;
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setSubmitted(true);
    setTimeout(() => navigate({ to: "/app/demandas" }), 900);
  }

  const nextId = `D-${2402}`;

  return (
    <AppShell
      title="Nova demanda"
      breadcrumbs={[
        { label: "OperaCondo" },
        { label: "Demandas", to: "/app/demandas" },
        { label: "Nova" },
      ]}
      actions={
        <>
          <Link
            to="/app/demandas"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
          >
            <Icon name="arrow_back" className="text-[18px]" /> Voltar
          </Link>
          <button
            form="form-nova-demanda"
            type="submit"
            className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)]"
          >
            <Icon name="send" className="text-[18px]" /> Abrir demanda
          </button>
        </>
      }
    >
      {submitted ? (
        <div className="card-elev mx-auto max-w-lg rounded-2xl p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <Icon name="check_circle" className="text-[32px]" filled />
          </div>
          <h2 className="mt-4 text-lg font-bold text-[var(--color-navy)]">
            Demanda {nextId} aberta
          </h2>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
            Encaminhando ao quadro de demandas…
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <form
            id="form-nova-demanda"
            onSubmit={onSubmit}
            noValidate
            className="space-y-5"
          >
            <FormSection
              icon="edit_note"
              title="Descrição do chamado"
              subtitle="O que aconteceu, quando e onde impacta"
            >
              <Field label="Título" error={errors.titulo}>
                <input
                  value={form.titulo}
                  onChange={(e) => set("titulo", e.target.value.slice(0, 120))}
                  maxLength={120}
                  placeholder="Ex.: Vazamento sob a pia da cozinha"
                  className={inputClass(errors.titulo)}
                />
              </Field>

              <Field
                label="Descrição detalhada"
                error={errors.descricao}
                hint={`${form.descricao.length}/1200`}
              >
                <textarea
                  value={form.descricao}
                  onChange={(e) =>
                    set("descricao", e.target.value.slice(0, 1200))
                  }
                  rows={5}
                  maxLength={1200}
                  placeholder="Contexto, sintomas, urgência, medidas já tomadas…"
                  className={inputClass(errors.descricao)}
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Categoria" error={errors.categoria}>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIAS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => set("categoria", c)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                          form.categoria === c
                            ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                            : "border-[var(--color-outline-variant)] bg-white text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
                        }`}
                      >
                        <Icon name={CAT_ICON[c]} className="text-[14px]" />
                        {c}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Prioridade">
                  <div className="grid grid-cols-3 gap-2">
                    {PRIORIDADES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => set("prioridade", p)}
                        className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                          form.prioridade === p
                            ? PRIO_CLASS[p]
                            : "border-[var(--color-outline-variant)] bg-white text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--color-on-surface-variant)]">
                    <Icon name="schedule" className="mr-1 text-[12px]" />
                    {SLA_POR_PRIORIDADE[form.prioridade]}
                  </p>
                </Field>
              </div>
            </FormSection>

            <FormSection
              icon="apartment"
              title="Onde e quem"
              subtitle="Condomínio, morador solicitante e local afetado"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Condomínio" error={errors.condominioId}>
                  <select
                    value={form.condominioId}
                    onChange={(e) => onCondominioChange(e.target.value)}
                    className={inputClass(errors.condominioId)}
                  >
                    <option value="">Selecione…</option>
                    {CONDOMINIOS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Morador solicitante" error={errors.moradorId}>
                  <select
                    value={form.moradorId}
                    onChange={(e) => set("moradorId", e.target.value)}
                    disabled={!form.condominioId}
                    className={inputClass(errors.moradorId)}
                  >
                    <option value="">
                      {form.condominioId
                        ? "Selecione…"
                        : "Escolha um condomínio antes"}
                    </option>
                    {moradoresFiltrados.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome} —{" "}
                        {m.endereco.tipo === "vertical"
                          ? `${m.endereco.bloco} · Apto ${m.endereco.apto}`
                          : `Qd ${m.endereco.quadra} · Casa ${m.endereco.casa}`}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Local afetado" error={errors.local}>
                <input
                  value={form.local}
                  onChange={(e) => set("local", e.target.value.slice(0, 120))}
                  maxLength={120}
                  placeholder="Ex.: Torre A • 12º andar • Apto 1204"
                  className={inputClass(errors.local)}
                />
              </Field>
            </FormSection>

            <FormSection
              icon="tune"
              title="Origem & custo"
              subtitle="Como o chamado chegou e estimativa financeira inicial"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Canal de entrada">
                  <div className="grid grid-cols-4 gap-2">
                    {CANAIS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => set("canal", c)}
                        className={`rounded-lg border px-2 py-2 text-[11px] font-semibold transition ${
                          form.canal === c
                            ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                            : "border-[var(--color-outline-variant)] bg-white text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Custo estimado (R$)" error={errors.custoEstimado}>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={form.custoEstimado}
                    onChange={(e) => set("custoEstimado", e.target.value)}
                    className={inputClass(errors.custoEstimado)}
                  />
                </Field>
              </div>
            </FormSection>
          </form>

          <aside className="space-y-5">
            <section className="card-elev rounded-2xl p-5">
              <h3 className="text-sm font-bold text-[var(--color-navy)]">
                Completude
              </h3>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-mid)]">
                <div
                  className="h-full rounded-full bg-[var(--color-brand)] transition-all"
                  style={{ width: `${completude}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[var(--color-on-surface-variant)]">
                {completude}% dos campos obrigatórios preenchidos.
              </p>
            </section>

            <section className="card-elev rounded-2xl p-5">
              <h3 className="text-sm font-bold text-[var(--color-navy)]">
                Prévia do card
              </h3>
              <div className="mt-3 rounded-xl border border-[var(--color-outline-variant)] bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-semibold text-[var(--color-on-surface-variant)]">
                    {nextId}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PRIO_CLASS[form.prioridade]}`}
                  >
                    {form.prioridade}
                  </span>
                </div>
                <h4 className="mt-2 text-sm font-semibold leading-snug text-[var(--color-navy)]">
                  {form.titulo || "Título da demanda"}
                </h4>
                <div className="mt-2 flex items-center gap-2 text-xs text-[var(--color-on-surface-variant)]">
                  {form.categoria ? (
                    <>
                      <Icon
                        name={CAT_ICON[form.categoria]}
                        className="text-[14px]"
                      />
                      {form.categoria}
                    </>
                  ) : (
                    <span>Categoria</span>
                  )}
                  <span className="text-[var(--color-outline)]">•</span>
                  {moradorSel?.nome ?? "Morador"}
                </div>
                <p className="mt-2 truncate text-[11px] text-[var(--color-on-surface-variant)]">
                  {form.local || "Local afetado"}
                </p>
                <div className="mt-3 inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                  <Icon name="schedule" className="text-[12px]" />
                  {SLA_POR_PRIORIDADE[form.prioridade]}
                </div>
              </div>
            </section>

            <section className="card-elev rounded-2xl p-5">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-navy)]/5 text-[var(--color-navy)]">
                  <Icon name="tips_and_updates" className="text-[18px]" />
                </div>
                <h3 className="text-sm font-bold text-[var(--color-navy)]">
                  Boas práticas
                </h3>
              </div>
              <ul className="mt-3 space-y-2 text-xs text-[var(--color-on-surface-variant)]">
                <li className="flex gap-2">
                  <Icon
                    name="check"
                    className="mt-0.5 text-[14px] text-emerald-600"
                  />
                  Descreva sintomas objetivos e horário do ocorrido.
                </li>
                <li className="flex gap-2">
                  <Icon
                    name="check"
                    className="mt-0.5 text-[14px] text-emerald-600"
                  />
                  Anexos podem ser enviados após abrir a demanda.
                </li>
                <li className="flex gap-2">
                  <Icon
                    name="check"
                    className="mt-0.5 text-[14px] text-emerald-600"
                  />
                  Prioridade "Crítica" aciona plantão de manutenção.
                </li>
              </ul>
            </section>
          </aside>
        </div>
      )}
    </AppShell>
  );
}

function FormSection({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-elev rounded-2xl p-5 lg:p-6">
      <header className="mb-4 flex items-start gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
          <Icon name={icon} className="text-[18px]" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-[var(--color-navy)]">{title}</h3>
          <p className="text-xs text-[var(--color-on-surface-variant)]">
            {subtitle}
          </p>
        </div>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--color-on-surface)]">
          {label}
        </span>
        {hint ? (
          <span className="text-[10px] text-[var(--color-on-surface-variant)]">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-600">
          <Icon name="error" className="text-[13px]" /> {error}
        </p>
      ) : null}
    </label>
  );
}

function inputClass(err?: string) {
  return `w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-[var(--color-on-surface)] outline-none transition placeholder:text-[var(--color-on-surface-variant)] focus:ring-2 focus:ring-[var(--color-brand)]/30 disabled:cursor-not-allowed disabled:bg-[var(--color-surface-mid)] disabled:text-[var(--color-on-surface-variant)] ${
    err
      ? "border-red-400 focus:border-red-500"
      : "border-[var(--color-outline-variant)] focus:border-[var(--color-brand)]"
  }`;
}
