import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";

export const Route = createFileRoute("/app/fornecedores/novo")({
  head: () => ({
    meta: [{ title: "Novo fornecedor | Concierge OperaCondo" }],
  }),
  component: NovoFornecedorPage,
});

const ESTADOS = ["Homologado", "Em análise", "Renovação", "Inativo"] as const;

const CATEGORIAS = [
  "Elétrica & Iluminação",
  "Hidráulica",
  "Piscina & Lazer",
  "Segurança Patrimonial",
  "Limpeza & Conservação",
  "Ar-condicionado",
  "Jardinagem",
  "Elevadores",
  "Dedetização",
  "Obras & Reformas",
  "TI & Telecom",
  "Administrativo",
] as const;

const schema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Informe o nome do fornecedor")
    .max(120, "Máximo de 120 caracteres"),
  categoria: z.enum(CATEGORIAS, {
    errorMap: () => ({ message: "Selecione uma categoria" }),
  }),
  cnpj: z
    .string()
    .trim()
    .regex(
      /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/,
      "CNPJ inválido (formato 00.000.000/0000-00)",
    ),
  contato: z
    .string()
    .trim()
    .min(3, "Informe o nome do contato")
    .max(80, "Máximo de 80 caracteres"),
  telefone: z
    .string()
    .trim()
    .regex(
      /^\+?\d{1,3}?\s?\(?\d{2,3}\)?\s?\d{4,5}-?\d{4}$/,
      "Telefone inválido",
    ),
  email: z.string().trim().email("E-mail inválido").max(255),
  estado: z.enum(ESTADOS),
  rating: z.coerce.number().min(0).max(5),
  observacoes: z.string().trim().max(500, "Máximo de 500 caracteres").optional(),
});

type FormState = {
  nome: string;
  categoria: string;
  cnpj: string;
  contato: string;
  telefone: string;
  email: string;
  estado: (typeof ESTADOS)[number];
  rating: string;
  observacoes: string;
};

const INITIAL: FormState = {
  nome: "",
  categoria: "",
  cnpj: "",
  contato: "",
  telefone: "",
  email: "",
  estado: "Em análise",
  rating: "0",
  observacoes: "",
};

function maskCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 13);
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d{2})(\d)/, "+$1 ($2) $3")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function NovoFornecedorPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitted, setSubmitted] = useState(false);

  const completude = useMemo(() => {
    const required: (keyof FormState)[] = [
      "nome",
      "categoria",
      "cnpj",
      "contato",
      "telefone",
      "email",
    ];
    const done = required.filter((k) => form[k].trim().length > 0).length;
    return Math.round((done / required.length) * 100);
  }, [form]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({
      ...form,
      rating: form.rating,
    });
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
    setTimeout(() => navigate({ to: "/app/fornecedores" }), 900);
  }

  return (
    <AppShell
      title="Cadastrar fornecedor"
      breadcrumbs={[
        { label: "OperaCondo" },
        { label: "Fornecedores", to: "/app/fornecedores" },
        { label: "Novo" },
      ]}
      actions={
        <>
          <Link
            to="/app/fornecedores"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
          >
            <Icon name="arrow_back" className="text-[18px]" /> Voltar
          </Link>
          <button
            form="form-novo-fornecedor"
            type="submit"
            className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)]"
          >
            <Icon name="save" className="text-[18px]" /> Salvar fornecedor
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
            Fornecedor cadastrado
          </h2>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
            Redirecionando para a lista…
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form
            id="form-novo-fornecedor"
            onSubmit={onSubmit}
            noValidate
            className="space-y-5"
          >
            <FormSection
              icon="storefront"
              title="Dados da empresa"
              subtitle="Informações institucionais e categoria de atendimento"
            >
              <Field label="Razão social / Nome fantasia" error={errors.nome}>
                <input
                  value={form.nome}
                  onChange={(e) => set("nome", e.target.value.slice(0, 120))}
                  maxLength={120}
                  placeholder="Ex.: ElétricaPro Engenharia LTDA"
                  className={inputClass(errors.nome)}
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Categoria principal" error={errors.categoria}>
                  <select
                    value={form.categoria}
                    onChange={(e) => set("categoria", e.target.value)}
                    className={inputClass(errors.categoria)}
                  >
                    <option value="">Selecione…</option>
                    {CATEGORIAS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="CNPJ" error={errors.cnpj}>
                  <input
                    value={form.cnpj}
                    onChange={(e) => set("cnpj", maskCnpj(e.target.value))}
                    placeholder="00.000.000/0000-00"
                    inputMode="numeric"
                    className={inputClass(errors.cnpj)}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection
              icon="contact_phone"
              title="Contato responsável"
              subtitle="Pessoa que atende chamados e recebe demandas via WhatsApp"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nome do contato" error={errors.contato}>
                  <input
                    value={form.contato}
                    onChange={(e) => set("contato", e.target.value.slice(0, 80))}
                    maxLength={80}
                    placeholder="Ex.: Carlos Andrade"
                    className={inputClass(errors.contato)}
                  />
                </Field>

                <Field label="Telefone / WhatsApp" error={errors.telefone}>
                  <input
                    value={form.telefone}
                    onChange={(e) => set("telefone", maskPhone(e.target.value))}
                    placeholder="+55 (11) 99999-9999"
                    inputMode="tel"
                    className={inputClass(errors.telefone)}
                  />
                </Field>
              </div>

              <Field label="E-mail" error={errors.email}>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value.slice(0, 255))}
                  maxLength={255}
                  placeholder="contato@fornecedor.com.br"
                  className={inputClass(errors.email)}
                />
              </Field>
            </FormSection>

            <FormSection
              icon="verified"
              title="Homologação & desempenho"
              subtitle="Status inicial no fluxo de aprovação do síndico"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Status inicial">
                  <div className="grid grid-cols-2 gap-2">
                    {ESTADOS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => set("estado", e)}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                          form.estado === e
                            ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                            : "border-[var(--color-outline-variant)] bg-white text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label={`Rating inicial (${form.rating}/5)`}>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.1}
                    value={form.rating}
                    onChange={(e) => set("rating", e.target.value)}
                    className="w-full accent-[var(--color-brand)]"
                  />
                </Field>
              </div>

              <Field
                label="Observações internas"
                error={errors.observacoes}
                hint={`${form.observacoes.length}/500`}
              >
                <textarea
                  value={form.observacoes}
                  onChange={(e) =>
                    set("observacoes", e.target.value.slice(0, 500))
                  }
                  rows={4}
                  maxLength={500}
                  placeholder="Especialidades, condições comerciais, SLA acordado…"
                  className={inputClass(errors.observacoes)}
                />
              </Field>
            </FormSection>
          </form>

          <aside className="space-y-5">
            <section className="card-elev rounded-2xl p-5">
              <h3 className="text-sm font-bold text-[var(--color-navy)]">
                Completude do cadastro
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
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-navy)]/5 text-[var(--color-navy)]">
                  <Icon name="tips_and_updates" className="text-[18px]" />
                </div>
                <h3 className="text-sm font-bold text-[var(--color-navy)]">
                  Dicas de homologação
                </h3>
              </div>
              <ul className="mt-3 space-y-2 text-xs text-[var(--color-on-surface-variant)]">
                <li className="flex gap-2">
                  <Icon
                    name="check"
                    className="mt-0.5 text-[14px] text-emerald-600"
                  />
                  Valide o CNPJ na Receita Federal antes de homologar.
                </li>
                <li className="flex gap-2">
                  <Icon
                    name="check"
                    className="mt-0.5 text-[14px] text-emerald-600"
                  />
                  Solicite comprovantes de regularidade (CND) e seguro.
                </li>
                <li className="flex gap-2">
                  <Icon
                    name="check"
                    className="mt-0.5 text-[14px] text-emerald-600"
                  />
                  Anexe contrato ou proposta comercial no perfil após salvar.
                </li>
              </ul>
            </section>

            <section className="card-elev rounded-2xl p-5">
              <h3 className="text-sm font-bold text-[var(--color-navy)]">
                Prévia
              </h3>
              <div className="mt-3 rounded-xl border border-[var(--color-outline-variant)] p-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-navy)] text-white">
                    <Icon name="storefront" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--color-navy)]">
                      {form.nome || "Nome do fornecedor"}
                    </p>
                    <p className="truncate text-[11px] text-[var(--color-on-surface-variant)]">
                      {form.categoria || "Categoria"}
                    </p>
                  </div>
                </div>
              </div>
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
  return `w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-[var(--color-on-surface)] outline-none transition placeholder:text-[var(--color-on-surface-variant)] focus:ring-2 focus:ring-[var(--color-brand)]/30 ${
    err
      ? "border-red-400 focus:border-red-500"
      : "border-[var(--color-outline-variant)] focus:border-[var(--color-brand)]"
  }`;
}
