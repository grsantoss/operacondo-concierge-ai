import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/brand/Icon";
import { createTenant } from "@/data/tenants";
import { PLANOS, getPlano, type PlanoId } from "@/data/planos";
import { formatBRL } from "@/data/faturas";

export const Route = createFileRoute("/admin/usuarios/novo")({
  head: () => ({
    meta: [
      { title: "Novo tenant — Admin Master | OperaCondo" },
      { name: "description", content: "Provisiona um novo síndico com plano, API Key e cliente Stripe." },
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
  const [plano, setPlano] = useState<PlanoId>("pro");
  const [trial, setTrial] = useState(true);
  const [created, setCreated] = useState<{ id: string; apiKey: string; senha: string } | null>(null);

  const set = (k: keyof typeof dados, v: string) => setDados((s) => ({ ...s, [k]: v }));

  const provision = () => {
    const p = getPlano(plano);
    const t = createTenant({
      ...dados,
      plano,
      status: trial ? "trial" : "ativo",
      mrr: trial ? 0 : p.precoMensal,
    });
    setCreated({ id: t.id, apiKey: t.apiKey, senha: `Temp@${Math.random().toString(36).slice(2, 8)}` });
    setStep(3);
  };

  if (created && step === 3) {
    return (
      <AdminShell
        title="Tenant provisionado"
        breadcrumbs={[
          { label: "Admin", to: "/admin" },
          { label: "Usuários", to: "/admin/usuarios" },
          { label: "Novo" },
        ]}
      >
        <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--color-outline-variant)] bg-white p-8 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)]">
            <Icon name="check_circle" className="text-[36px]" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-navy)]">Conta criada com sucesso</h2>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
            Compartilhe as credenciais abaixo com o síndico. A senha temporária deve ser trocada no primeiro acesso.
          </p>

          <div className="mt-6 space-y-3 text-left">
            <Credential label="ID do tenant" value={created.id} />
            <Credential label="API Key (única do tenant)" value={created.apiKey} mono />
            <Credential label="Senha temporária" value={created.senha} />
          </div>

          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => navigate({ to: "/admin/usuarios/$id", params: { id: created.id } })}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover)]"
            >
              Abrir tenant
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
      title="Novo tenant"
      breadcrumbs={[
        { label: "Admin", to: "/admin" },
        { label: "Usuários", to: "/admin/usuarios" },
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
                <TextField label="E-mail institucional" value={dados.email} onChange={(v) => set("email", v)} />
                <TextField label="Telefone" value={dados.telefone} onChange={(v) => set("telefone", v)} />
                <TextField label="Responsável legal" value={dados.responsavel} onChange={(v) => set("responsavel", v)} />
                <TextField label="Cidade" value={dados.cidade} onChange={(v) => set("cidade", v)} />
                <TextField label="UF" value={dados.uf} onChange={(v) => set("uf", v.toUpperCase().slice(0, 2))} />
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  disabled={!dados.razaoSocial || !dados.nomeFantasia || !dados.email}
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
                Escolha o plano inicial. Você pode alterar depois na página do tenant.
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {PLANOS.map((p) => {
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
                        {p.destaque && (
                          <span className="rounded-full bg-[var(--color-brand)] px-2 py-0.5 text-[9px] font-bold uppercase text-white">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-2xl font-bold text-[var(--color-brand)]">{formatBRL(p.precoMensal)}</p>
                      <p className="text-[11px] text-[var(--color-on-surface-variant)]">/mês</p>
                      <ul className="mt-3 space-y-1 text-xs text-[var(--color-on-surface-variant)]">
                        <li>Até {p.moradores.toLocaleString("pt-BR")} moradores</li>
                        <li>{p.msgsMes.toLocaleString("pt-BR")} msgs/mês</li>
                        <li>{p.condominios} condomínio(s)</li>
                      </ul>
                    </button>
                  );
                })}
              </div>

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] p-3">
                <input type="checkbox" checked={trial} onChange={(e) => setTrial(e.target.checked)} className="mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[var(--color-navy)]">Iniciar em modo Trial (14 dias)</p>
                  <p className="text-xs text-[var(--color-on-surface-variant)]">
                    Sem cobrança imediata. Ao final do período, a cobrança automática é ativada no Stripe.
                  </p>
                </div>
              </label>

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
                >
                  <Icon name="arrow_back" className="text-[16px]" /> Voltar
                </button>
                <button
                  onClick={provision}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover)]"
                >
                  Provisionar tenant <Icon name="check" className="text-[16px]" />
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
