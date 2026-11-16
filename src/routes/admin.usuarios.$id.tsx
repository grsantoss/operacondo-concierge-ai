import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/brand/Icon";
import { faturasQuery, formatBRL, STATUS_LABEL, STATUS_TONE, useFaturas } from "@/data/faturas";
import { planosQuery, usePlanos } from "@/data/planos";
import {
  clientesQuery,
  erroAmigavel,
  STATUS_CLIENTE,
  useClientesAcoes,
  useTenants,
  type DadosCliente,
  type Tenant,
} from "@/data/tenants";

export const Route = createFileRoute("/admin/usuarios/$id")({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(clientesQuery),
      queryClient.ensureQueryData(planosQuery),
      queryClient.ensureQueryData(faturasQuery),
    ]),
  head: () => ({ meta: [{ title: "Cliente — Admin Master | OperaCondo" }] }),
  component: TenantDetail,
});

type Tab = "perfil" | "usuarios" | "uso" | "cobranca";

const PAPEL: Record<string, string> = {
  sindico: "Síndico",
  conselho: "Conselho",
  admin: "Administrador",
};

function TenantDetail() {
  const { id } = Route.useParams();
  const t = useTenants().find((x) => x.id === id);
  const [tab, setTab] = useState<Tab>("perfil");

  if (!t) {
    return (
      <AdminShell
        title="Cliente não encontrado"
        breadcrumbs={[
          { label: "Admin", to: "/admin" },
          { label: "Clientes", to: "/admin/usuarios" },
        ]}
      >
        <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-10 text-center">
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Este cliente não existe ou foi removido.
          </p>
          <Link
            to="/admin/usuarios"
            className="mt-4 inline-flex text-sm font-semibold text-[var(--color-brand)] hover:underline"
          >
            ← Voltar à lista
          </Link>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={t.nomeFantasia}
      breadcrumbs={[
        { label: "Admin", to: "/admin" },
        { label: "Clientes", to: "/admin/usuarios" },
        { label: t.nomeFantasia },
      ]}
      actions={
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_CLIENTE[t.status].tone}`}
        >
          {STATUS_CLIENTE[t.status].label}
          {t.status === "trial" && t.trialFim
            ? ` até ${t.trialFim.split("-").reverse().join("/")}`
            : ""}
        </span>
      }
    >
      <div className="mb-5 flex flex-wrap gap-1 rounded-xl bg-white p-1 shadow-soft">
        {(
          [
            { id: "perfil", label: "Perfil", icon: "business" },
            { id: "usuarios", label: "Usuários", icon: "group" },
            { id: "uso", label: "Uso", icon: "monitoring" },
            { id: "cobranca", label: "Cobrança", icon: "receipt_long" },
          ] as const
        ).map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === x.id
                ? "bg-[var(--color-brand)] text-white"
                : "text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
            }`}
          >
            <Icon name={x.icon} className="text-[16px]" />
            {x.label}
          </button>
        ))}
      </div>

      {tab === "perfil" && <PerfilForm key={t.id} t={t} />}
      {tab === "usuarios" && <Usuarios t={t} />}
      {tab === "uso" && <Uso t={t} />}
      {tab === "cobranca" && <Cobranca t={t} />}
    </AdminShell>
  );
}

function PerfilForm({ t }: { t: Tenant }) {
  const { atualizar } = useClientesAcoes();
  const [d, setD] = useState<DadosCliente>({
    razaoSocial: t.razaoSocial,
    nomeFantasia: t.nomeFantasia,
    cnpj: t.cnpj,
    email: t.email,
    telefone: t.telefone,
    cidade: t.cidade,
    uf: t.uf,
    responsavel: t.responsavel,
  });
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof DadosCliente, v: string) => setD((s) => ({ ...s, [k]: v }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setMsg(null);
    try {
      await atualizar(t.id, d);
      setMsg({ ok: true, texto: "Dados salvos." });
    } catch (err) {
      setMsg({ ok: false, texto: erroAmigavel(err) });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form
      onSubmit={salvar}
      className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-6"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Razão social"
          value={d.razaoSocial}
          onChange={(v) => set("razaoSocial", v)}
        />
        <TextField
          label="Nome fantasia"
          value={d.nomeFantasia}
          onChange={(v) => set("nomeFantasia", v)}
        />
        <TextField label="CNPJ" value={d.cnpj} onChange={(v) => set("cnpj", v)} />
        <TextField label="E-mail" value={d.email} onChange={(v) => set("email", v)} />
        <TextField label="Telefone" value={d.telefone} onChange={(v) => set("telefone", v)} />
        <TextField
          label="Responsável"
          value={d.responsavel}
          onChange={(v) => set("responsavel", v)}
        />
        <TextField label="Cidade" value={d.cidade} onChange={(v) => set("cidade", v)} />
        <TextField
          label="UF"
          value={d.uf}
          onChange={(v) => set("uf", v.toUpperCase().slice(0, 2))}
        />
      </div>
      <div className="mt-5 flex items-center justify-end gap-3">
        {msg ? (
          <p
            role={msg.ok ? "status" : "alert"}
            className={`text-sm ${msg.ok ? "text-success-strong" : "text-destructive"}`}
          >
            {msg.texto}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={salvando}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover)] disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}

function Usuarios({ t }: { t: Tenant }) {
  return (
    <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-surface-low)] text-left text-xs uppercase text-[var(--color-on-surface-variant)]">
          <tr>
            <th className="px-5 py-3">Nome</th>
            <th className="px-5 py-3">E-mail</th>
            <th className="px-5 py-3">Papel</th>
          </tr>
        </thead>
        <tbody>
          {t.membros.map((m) => (
            <tr key={m.email} className="border-t border-[var(--color-outline-variant)]">
              <td className="px-5 py-3 font-semibold text-[var(--color-navy)]">{m.nome}</td>
              <td className="px-5 py-3">{m.email}</td>
              <td className="px-5 py-3">{PAPEL[m.papel] ?? m.papel}</td>
            </tr>
          ))}
          {t.membros.length === 0 && (
            <tr>
              <td
                colSpan={3}
                className="px-5 py-6 text-center text-sm text-[var(--color-on-surface-variant)]"
              >
                Nenhum usuário com acesso a este cliente.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Uso({ t }: { t: Tenant }) {
  // Durante o trial valem os limites do plano interno `trial`, não os do plano escolhido.
  const id = t.assinaturaStatus === "trialing" ? "trial" : t.plano;
  const p = usePlanos().find((x) => x.id === id);
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <UsageCard
        label="Condomínios"
        value={t.uso.condominios}
        max={p?.condominios}
        icon="apartment"
      />
      <UsageCard label="Moradores" value={t.uso.moradores} max={p?.moradores} icon="group" />
      <UsageCard
        label="Documentos na base"
        value={t.uso.documentos}
        max={p?.documentos}
        icon="description"
      />
      <UsageCard
        label="Respostas da IA no mês"
        value={t.uso.respostasIa}
        max={p?.respostasIaMes}
        icon="chat"
      />
    </div>
  );
}

function Cobranca({ t }: { t: Tenant }) {
  const planos = usePlanos();
  const { trocarPlano } = useClientesAcoes();
  const faturas = useFaturas().filter((f) => f.tenantId === t.id);
  const [erro, setErro] = useState<string | null>(null);
  const atual = planos.find((x) => x.id === t.plano);
  const proxima = faturas.find((f) => f.status === "open" || f.status === "past_due");

  async function trocar(planoId: string) {
    setErro(null);
    try {
      await trocarPlano(t.id, planoId);
    } catch (err) {
      setErro(erroAmigavel(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-[var(--color-navy)]">Plano atual</h3>
            <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
              {t.stripeSubscriptionId ? (
                <>
                  Assinatura Stripe:{" "}
                  <span className="font-mono text-xs">{t.stripeSubscriptionId}</span>
                </>
              ) : (
                "Sem assinatura no Stripe ainda (a cobrança entra na Fase 6)."
              )}
            </p>
          </div>
          <span className="rounded-full bg-[var(--color-brand)]/10 px-3 py-1 text-sm font-bold text-[var(--color-brand)]">
            {atual ? `${atual.nome} — ${formatBRL(atual.precoMensal)}/mês` : "Sem plano"}
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {planos
            .filter((pl) => pl.vendavel)
            .map((pl) => (
              <button
                key={pl.id}
                aria-pressed={pl.id === t.plano}
                onClick={() => trocar(pl.id)}
                className={`rounded-xl border-2 p-3 text-left text-sm transition ${
                  pl.id === t.plano
                    ? "border-[var(--color-brand)] bg-[var(--color-info-soft)]"
                    : "border-[var(--color-outline-variant)] hover:border-[var(--color-brand)]/40"
                }`}
              >
                <p className="font-bold text-[var(--color-navy)]">{pl.nome}</p>
                <p className="font-semibold text-[var(--color-brand)]">
                  {formatBRL(pl.precoMensal)}
                </p>
              </button>
            ))}
        </div>
        {erro ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {erro}
          </p>
        ) : null}
      </div>

      {proxima && (
        <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-6">
          <h3 className="text-base font-bold text-[var(--color-navy)]">Fatura em aberto</h3>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-[var(--color-navy)]">
                {formatBRL(proxima.valor)}
              </p>
              <p className="text-xs text-[var(--color-on-surface-variant)]">
                Vence em {proxima.vencimento} · {proxima.metodo}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_TONE[proxima.status]}`}
            >
              {STATUS_LABEL[proxima.status]}
            </span>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white">
        <div className="border-b border-[var(--color-outline-variant)] p-5">
          <h3 className="text-base font-bold text-[var(--color-navy)]">Histórico de faturas</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-low)] text-left text-xs uppercase text-[var(--color-on-surface-variant)]">
            <tr>
              <th className="px-5 py-3">Período</th>
              <th className="px-5 py-3">Valor</th>
              <th className="px-5 py-3">Método</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Stripe ID</th>
            </tr>
          </thead>
          <tbody>
            {faturas.map((f) => (
              <tr key={f.id} className="border-t border-[var(--color-outline-variant)]">
                <td className="px-5 py-3">{f.periodo}</td>
                <td className="px-5 py-3 font-semibold">{formatBRL(f.valor)}</td>
                <td className="px-5 py-3 text-xs">{f.metodo}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[f.status]}`}
                  >
                    {STATUS_LABEL[f.status]}
                  </span>
                </td>
                <td className="px-5 py-3 font-mono text-[11px] text-[var(--color-on-surface-variant)]">
                  {f.stripeInvoiceId}
                </td>
              </tr>
            ))}
            {faturas.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-6 text-center text-sm text-[var(--color-on-surface-variant)]"
                >
                  Sem faturas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--color-navy)]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15"
      />
    </label>
  );
}

function UsageCard({
  label,
  value,
  max,
  icon,
}: {
  label: string;
  value: number;
  max?: number;
  icon: string;
}) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : null;
  return (
    <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-[var(--color-on-surface-variant)]">
          {label}
        </p>
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-info-soft)] text-[var(--color-brand)]">
          <Icon name={icon} className="text-[18px]" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold text-[var(--color-navy)]">
        {value.toLocaleString("pt-BR")}
      </p>
      {max ? (
        <>
          <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
            de {max.toLocaleString("pt-BR")} no plano
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-mid)]">
            <div
              className={`h-full ${pct! >= 80 ? "bg-[var(--color-danger)]" : "bg-[var(--color-brand)]"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
