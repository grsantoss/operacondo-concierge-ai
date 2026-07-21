import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/brand/Icon";
import { ConfirmDialog } from "@/components/moradores/ConfirmDialog";
import { useTenants, updateTenant, deleteTenant, rotateApiKey } from "@/data/tenants";
import { useFaturas, STATUS_LABEL, STATUS_TONE, formatBRL } from "@/data/faturas";
import { PLANOS, getPlano, type PlanoId } from "@/data/planos";

export const Route = createFileRoute("/admin/usuarios/$id")({
  head: ({ params }) => ({
    meta: [{ title: `Tenant ${params.id} — Admin Master | OperaCondo` }],
  }),
  component: TenantDetail,
});

type Tab = "perfil" | "api" | "uso" | "cobranca";

function TenantDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const tenants = useTenants();
  const faturas = useFaturas();
  const t = tenants.find((x) => x.id === id);
  const [tab, setTab] = useState<Tab>("perfil");
  const [showKey, setShowKey] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);

  if (!t) {
    return (
      <AdminShell title="Tenant não encontrado" breadcrumbs={[{ label: "Admin", to: "/admin" }, { label: "Usuários", to: "/admin/usuarios" }]}>
        <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-10 text-center">
          <p className="text-sm text-[var(--color-on-surface-variant)]">Este tenant não existe ou foi removido.</p>
          <Link to="/admin/usuarios" className="mt-4 inline-flex text-sm font-semibold text-[var(--color-brand)] hover:underline">
            ← Voltar à lista
          </Link>
        </div>
      </AdminShell>
    );
  }

  const p = getPlano(t.plano);
  const tenantFaturas = faturas.filter((f) => f.tenantId === t.id);
  const nextInvoice = tenantFaturas.find((f) => f.status === "open") ?? tenantFaturas[0];

  const set = <K extends keyof typeof t>(k: K, v: (typeof t)[K]) => updateTenant(t.id, { [k]: v } as Partial<typeof t>);

  return (
    <AdminShell
      title={t.nomeFantasia}
      breadcrumbs={[
        { label: "Admin", to: "/admin" },
        { label: "Usuários", to: "/admin/usuarios" },
        { label: t.nomeFantasia },
      ]}
      actions={
        <>
          <button
            onClick={() =>
              updateTenant(t.id, {
                status: t.status === "suspenso" ? "ativo" : "suspenso",
                apiStatus: t.status === "suspenso" ? "ativa" : "revogada",
                mrr: t.status === "suspenso" ? p.precoMensal : 0,
              })
            }
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
          >
            <Icon name={t.status === "suspenso" ? "play_arrow" : "pause"} className="text-[16px]" />
            {t.status === "suspenso" ? "Reativar" : "Suspender"}
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <Icon name="delete" className="text-[16px]" /> Excluir
          </button>
        </>
      }
    >
      <div className="mb-5 flex flex-wrap gap-1 rounded-xl bg-white p-1 shadow-sm">
        {(
          [
            { id: "perfil" as Tab, label: "Perfil", icon: "business" },
            { id: "api" as Tab, label: "API & Integrações", icon: "key" },
            { id: "uso" as Tab, label: "Uso", icon: "monitoring" },
            { id: "cobranca" as Tab, label: "Cobrança", icon: "receipt_long" },
          ] as const
        ).map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === x.id ? "bg-[var(--color-brand)] text-white" : "text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
            }`}
          >
            <Icon name={x.icon} className="text-[16px]" />
            {x.label}
          </button>
        ))}
      </div>

      {tab === "perfil" && (
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Razão social" value={t.razaoSocial} onChange={(v) => set("razaoSocial", v)} />
          <TextField label="Nome fantasia" value={t.nomeFantasia} onChange={(v) => set("nomeFantasia", v)} />
          <TextField label="CNPJ" value={t.cnpj} onChange={(v) => set("cnpj", v)} />
          <TextField label="E-mail" value={t.email} onChange={(v) => set("email", v)} />
          <TextField label="Telefone" value={t.telefone} onChange={(v) => set("telefone", v)} />
          <TextField label="Responsável" value={t.responsavel} onChange={(v) => set("responsavel", v)} />
          <TextField label="Cidade" value={t.cidade} onChange={(v) => set("cidade", v)} />
          <TextField label="UF" value={t.uf} onChange={(v) => set("uf", v.toUpperCase().slice(0, 2))} />
        </div>
      )}

      {tab === "api" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[var(--color-navy)]">API Key do tenant</h3>
                <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
                  Chave única e privada deste tenant. Toda chamada à API OperaCondo autentica com ela e escopo é limitado aos dados deste tenant.
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${
                  t.apiStatus === "ativa"
                    ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                    : "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
                }`}
              >
                {t.apiStatus === "ativa" ? "Ativa" : "Revogada"}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] p-3 font-mono text-sm">
              <span className="flex-1 truncate text-[var(--color-navy)]">
                {showKey ? t.apiKey : `${t.apiKey.slice(0, 12)}${"•".repeat(20)}`}
              </span>
              <button
                onClick={() => setShowKey((v) => !v)}
                className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-brand)] hover:bg-white"
                title={showKey ? "Ocultar" : "Mostrar"}
              >
                <Icon name={showKey ? "visibility_off" : "visibility"} className="text-[16px]" />
              </button>
              <button
                onClick={() => navigator.clipboard?.writeText(t.apiKey)}
                className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-brand)] hover:bg-white"
                title="Copiar"
              >
                <Icon name="content_copy" className="text-[16px]" />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setConfirmRotate(true)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
              >
                <Icon name="sync" className="text-[16px]" /> Rotacionar chave
              </button>
              <button
                onClick={() => updateTenant(t.id, { apiStatus: t.apiStatus === "ativa" ? "revogada" : "ativa" })}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <Icon name={t.apiStatus === "ativa" ? "block" : "check"} className="text-[16px]" />
                {t.apiStatus === "ativa" ? "Revogar" : "Reativar"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-6">
            <h3 className="text-base font-bold text-[var(--color-navy)]">Webhooks</h3>
            <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
              URL que recebe eventos deste tenant (demandas criadas, mensagens IA, cobranças).
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                defaultValue={`https://api.${t.nomeFantasia.toLowerCase().replace(/\s/g, "")}.com.br/webhooks/operacondo`}
                className="h-10 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 font-mono text-xs outline-none"
              />
              <button className="h-10 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]">
                Enviar evento de teste
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-6">
            <h3 className="text-base font-bold text-[var(--color-navy)]">Escopos permitidos</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {["demandas:read", "demandas:write", "moradores:read", "moradores:write", "agente:read", "cobrancas:read"].map((s) => (
                <label key={s} className="flex items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] p-2.5">
                  <input type="checkbox" defaultChecked className="accent-[var(--color-brand)]" />
                  <span className="font-mono text-xs text-[var(--color-navy)]">{s}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "uso" && (
        <div className="grid gap-4 md:grid-cols-3">
          <UsageCard label="Demandas" value={t.uso.demandas} icon="assignment" />
          <UsageCard label="Moradores" value={t.uso.moradores} max={p.moradores} icon="group" />
          <UsageCard label="Mensagens WhatsApp" value={t.uso.msgs} max={p.msgsMes} icon="chat" />
        </div>
      )}

      {tab === "cobranca" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[var(--color-navy)]">Plano atual</h3>
                <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
                  Assinatura Stripe: <span className="font-mono text-xs">{t.stripeSubscriptionId}</span>
                </p>
              </div>
              <span className="rounded-full bg-[var(--color-brand)]/10 px-3 py-1 text-sm font-bold text-[var(--color-brand)]">
                {p.nome} — {formatBRL(p.precoMensal)}/mês
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {PLANOS.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() =>
                    updateTenant(t.id, {
                      plano: pl.id as PlanoId,
                      mrr: t.status === "ativo" ? pl.precoMensal : 0,
                    })
                  }
                  className={`rounded-xl border-2 p-3 text-left text-sm transition ${
                    pl.id === t.plano
                      ? "border-[var(--color-brand)] bg-[var(--color-info-soft)]"
                      : "border-[var(--color-outline-variant)] hover:border-[var(--color-brand)]/40"
                  }`}
                >
                  <p className="font-bold text-[var(--color-navy)]">{pl.nome}</p>
                  <p className="text-[var(--color-brand)] font-semibold">{formatBRL(pl.precoMensal)}</p>
                </button>
              ))}
            </div>
          </div>

          {nextInvoice && (
            <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-6">
              <h3 className="text-base font-bold text-[var(--color-navy)]">Próxima fatura</h3>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-[var(--color-navy)]">{formatBRL(nextInvoice.valor)}</p>
                  <p className="text-xs text-[var(--color-on-surface-variant)]">
                    Vence em {nextInvoice.vencimento} · {nextInvoice.metodo.toUpperCase()}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_TONE[nextInvoice.status]}`}>
                  {STATUS_LABEL[nextInvoice.status]}
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
                {tenantFaturas.map((f) => (
                  <tr key={f.id} className="border-t border-[var(--color-outline-variant)]">
                    <td className="px-5 py-3">{f.periodo}</td>
                    <td className="px-5 py-3 font-semibold">{formatBRL(f.valor)}</td>
                    <td className="px-5 py-3 uppercase text-[11px]">{f.metodo}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[f.status]}`}>
                        {STATUS_LABEL[f.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-[11px] text-[var(--color-on-surface-variant)]">{f.stripeInvoiceId}</td>
                  </tr>
                ))}
                {tenantFaturas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-sm text-[var(--color-on-surface-variant)]">
                      Sem faturas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`Excluir ${t.nomeFantasia}?`}
        description="Todos os dados desta conta serão removidos permanentemente."
        confirmLabel="Excluir tenant"
        requireCheckboxLabel="Entendo que esta ação é irreversível."
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteTenant(t.id);
          navigate({ to: "/admin/usuarios" });
        }}
      />

      <ConfirmDialog
        open={confirmRotate}
        tone="warn"
        icon="sync"
        title="Rotacionar API Key?"
        description="A chave atual será invalidada. Todas as integrações do tenant precisarão ser atualizadas com a nova chave."
        confirmLabel="Rotacionar"
        onClose={() => setConfirmRotate(false)}
        onConfirm={() => {
          rotateApiKey(t.id);
          setConfirmRotate(false);
          setShowKey(true);
        }}
      />
    </AdminShell>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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

function UsageCard({ label, value, max, icon }: { label: string; value: number; max?: number; icon: string }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : null;
  return (
    <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-[var(--color-on-surface-variant)]">{label}</p>
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-info-soft)] text-[var(--color-brand)]">
          <Icon name={icon} className="text-[18px]" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold text-[var(--color-navy)]">{value.toLocaleString("pt-BR")}</p>
      {max && (
        <>
          <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
            de {max.toLocaleString("pt-BR")} disponíveis
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-mid)]">
            <div
              className={`h-full ${pct! > 85 ? "bg-[var(--color-danger)]" : "bg-[var(--color-brand)]"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}
