import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/brand/Icon";
import { formatBRL } from "@/data/faturas";
import { planosQuery, usePlanos } from "@/data/planos";
import { erroAmigavel, useClientesAcoes } from "@/data/tenants";

export const Route = createFileRoute("/admin/usuarios/novo")({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(planosQuery),
  head: () => ({
    meta: [
      { title: "Novo cliente — Admin Master | OperaCondo" },
      { name: "description", content: "Cadastra um novo cliente com plano e acesso do síndico." },
    ],
  }),
  component: NovoTenant,
});

function NovoTenant() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [dados, setDados] = useState({
    razaoSocial: "",
    nomeFantasia: "",
    cnpj: "",
    email: "",
    telefone: "",
    cidade: "",
    uf: "SP",
    responsavel: "",
  });
  const planos = usePlanos().filter((p) => p.vendavel);
  const { criar } = useClientesAcoes();
  const [plano, setPlano] = useState("pro");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [created, setCreated] = useState<{ id: string; email: string; senha: string } | null>(null);

  const set = (k: keyof typeof dados, v: string) => setDados((s) => ({ ...s, [k]: v }));

  const provision = async () => {
    setErro(null);
    setEnviando(true);
    try {
      setCreated(await criar({ ...dados, planoId: plano }));
      setStep(3);
    } catch (err) {
      setErro(erroAmigavel(err));
    } finally {
      setEnviando(false);
    }
  };

  if (created && step === 3) {
    return (
      <AdminShell
        title="Cliente cadastrado"
        breadcrumbs={[
          { label: "Admin", to: "/admin" },
          { label: "Clientes", to: "/admin/usuarios" },
          { label: "Novo" },
        ]}
      >
        <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--color-outline-variant)] bg-white p-8 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success-strong)]">
            <Icon name="check_circle" className="text-[36px]" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-navy)]">Conta criada com sucesso</h2>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
            Envie o acesso abaixo ao síndico. A senha temporária aparece só agora; ele pode trocá-la depois.
          </p>

          <div className="mt-6 space-y-3 text-left">
            <Credential label="E-mail de acesso" value={created.email} />
            <Credential label="Senha temporária" value={created.senha} mono />
          </div>

          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => navigate({ to: "/admin/usuarios/$id", params: { id: created.id } })}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover)]"
            >
              Abrir cliente
              <Icon name="arrow_forward" className="text-[16px]" />
            </button>
            <button
              onClick={() => navigate({ to: "/admin/usuarios" })}
              className="inline-flex h-10 items-center rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
            >
              Voltar à lista
            </button>
          </div>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Novo cliente"
      breadcrumbs={[
        { label: "Admin", to: "/admin" },
        { label: "Clientes", to: "/admin/usuarios" },
        { label: "Novo" },
      ]}
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex flex-1 items-center gap-2">
              <div
                className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${
                  n <= step ? "bg-[var(--color-brand)] text-white" : "bg-[var(--color-surface-mid)] text-[var(--color-on-surface-variant)]"
                }`}
              >
                {n}
              </div>
              {n < 3 && <div className={`h-0.5 flex-1 ${n < step ? "bg-[var(--color-brand)]" : "bg-[var(--color-surface-mid)]"}`} />}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-6">
          {step === 1 && (
            <>
              <h2 className="text-lg font-bold text-[var(--color-navy)]">Dados corporativos</h2>
              <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
                Informações fiscais e de contato do síndico/administradora.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <TextField label="Razão social" value={dados.razaoSocial} onChange={(v) => set("razaoSocial", v)} />
                <TextField label="Nome fantasia" value={dados.nomeFantasia} onChange={(v) => set("nomeFantasia", v)} />
                <TextField label="CNPJ" value={dados.cnpj} onChange={(v) => set("cnpj", v)} placeholder="00.000.000/0000-00" />
                <TextField label="E-mail do síndico (login)" value={dados.email} onChange={(v) => set("email", v)} />
                <TextField label="Telefone" value={dados.telefone} onChange={(v) => set("telefone", v)} />
                <TextField label="Responsável legal" value={dados.responsavel} onChange={(v) => set("responsavel", v)} />
                <TextField label="Cidade" value={dados.cidade} onChange={(v) => set("cidade", v)} />
                <TextField label="UF" value={dados.uf} onChange={(v) => set("uf", v.toUpperCase().slice(0, 2))} />
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  disabled={!dados.razaoSocial || !dados.nomeFantasia || !dados.email || !dados.responsavel}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover)] disabled:opacity-50"
                >
                  Próximo <Icon name="arrow_forward" className="text-[16px]" />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-lg font-bold text-[var(--color-navy)]">Plano e limites</h2>
              <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
                Escolha o plano. Dá para trocar depois na página do cliente.
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {planos.map((p) => {
                  const sel = p.id === plano;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPlano(p.id)}
                      className={`rounded-xl border-2 p-4 text-left transition ${
                        sel
                          ? "border-[var(--color-brand)] bg-[var(--color-info-soft)]"
                          : "border-[var(--color-outline-variant)] bg-white hover:border-[var(--color-brand)]/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-[var(--color-navy)]">{p.nome}</p>
                      </div>
                      <p className="mt-1 text-2xl font-bold text-[var(--color-brand)]">{formatBRL(p.precoMensal)}</p>
                      <p className="text-[11px] text-[var(--color-on-surface-variant)]">/mês</p>
                      <ul className="mt-3 space-y-1 text-xs text-[var(--color-on-surface-variant)]">
                        <li>Até {p.moradores.toLocaleString("pt-BR")} moradores</li>
                        <li>{p.respostasIaMes.toLocaleString("pt-BR")} respostas da IA/mês</li>
                        <li>{p.condominios} condomínio(s)</li>
                      </ul>
                    </button>
                  );
                })}
              </div>

              <p className="mt-5 flex items-start gap-3 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] p-3 text-xs text-[var(--color-on-surface-variant)]">
                <Icon name="info" className="mt-0.5 text-[16px] text-[var(--color-brand)]" />
                <span>
                  O cliente começa em <strong>trial de 7 dias</strong> com limites reduzidos (1 condomínio,
                  50 moradores, 150 respostas da IA). A cobrança pelo Stripe entra numa próxima fase.
                </span>
              </p>
              {erro ? (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {erro}
                </p>
              ) : null}

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
                >
                  <Icon name="arrow_back" className="text-[16px]" /> Voltar
                </button>
                <button
                  onClick={provision}
                  disabled={enviando}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover)] disabled:opacity-60"
                >
                  {enviando ? "Cadastrando…" : "Cadastrar cliente"} <Icon name="check" className="text-[16px]" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--color-navy)]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15"
      />
    </label>
  );
}

function Credential({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const copy = () => navigator.clipboard?.writeText(value);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] p-3">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-on-surface-variant)]">{label}</p>
        <p className={`truncate text-sm font-semibold text-[var(--color-navy)] ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
      <button
        onClick={copy}
        className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-brand)] hover:bg-white"
        title="Copiar"
      >
        <Icon name="content_copy" className="text-[16px]" />
      </button>
    </div>
  );
}
