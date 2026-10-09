import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";
import { WhatsAppIcon } from "@/components/brand/WhatsAppIcon";
import { ConfirmDialog } from "@/components/moradores/ConfirmDialog";
import { EditMoradorModal } from "@/components/moradores/EditMoradorModal";
import {
  CONDOMINIOS,
  STATUS_CLS,
  deactivateMorador,
  formatEndereco,
  getMorador,
  initials,
  reactivateMorador,
  useMoradores,
  whatsappUrl,
  type Morador,
} from "@/data/moradores";
import { CAT_ICON, DEMANDAS, PRIO_CLASS, type Demanda } from "@/data/demandas";

export const Route = createFileRoute("/app/moradores/$id")({
  loader: ({ params }) => {
    const morador = getMorador(params.id);
    if (!morador) throw notFound();
    const condo = CONDOMINIOS.find((c) => c.id === morador.condominioId)!;
    const chamados = DEMANDAS.filter((d) => d.morador === morador.nome);
    return { morador, condo, chamados };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.morador.nome} | Moradores`
          : "Morador não encontrado",
      },
    ],
  }),
  errorComponent: MoradorError,
  notFoundComponent: MoradorNotFound,
  component: MoradorDetail,
});

type Tab = "chamados" | "historico" | "unidade";

function MoradorDetail() {
  const loaderData = Route.useLoaderData() as {
    morador: Morador;
    condo: (typeof CONDOMINIOS)[number];
    chamados: Demanda[];
  };
  const router = useRouter();
  // Subscribe to store so edits/deactivations reflect immediately
  const all = useMoradores({ includeInactive: true });
  const morador = all.find((m) => m.id === loaderData.morador.id) ?? loaderData.morador;
  const condo = CONDOMINIOS.find((c) => c.id === morador.condominioId) ?? loaderData.condo;
  const chamados = loaderData.chamados;

  const [tab, setTab] = useState<Tab>("chamados");
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmReactivate, setConfirmReactivate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const end = formatEndereco(morador.endereco);
  const isVago = morador.status === "Vago";
  const isInativo = morador.status === "Inativo";

  const stats = useMemo(() => {
    const abertos = chamados.filter((c) => c.column !== "resolvidas").length;
    const resolvidos = chamados.filter((c) => c.column === "resolvidas").length;
    const criticos = chamados.filter((c) => c.priority === "Crítica").length;
    const gasto = chamados.reduce(
      (s, c) => s + (c.cost?.approved ?? 0),
      0,
    );
    return { total: chamados.length, abertos, resolvidos, criticos, gasto };
  }, [chamados]);

  const abertos = chamados.filter((c) => c.column !== "resolvidas");
  const resolvidos = chamados.filter((c) => c.column === "resolvidas");

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  return (
    <AppShell
      title={morador.nome}
      breadcrumbs={[
        { label: "OperaCondo" },
        { label: "Moradores", to: "/app/moradores" },
        { label: morador.nome },
      ]}
      actions={
        <>
          <Link
            to="/app/moradores"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
          >
            <Icon name="arrow_back" className="text-[18px]" /> Voltar
          </Link>
          <button
            onClick={() => setShowEdit(true)}
            className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
          >
            <Icon name="edit" className="text-[18px]" /> Editar
          </button>
          {isInativo ? (
            <button
              onClick={() => setConfirmReactivate(true)}
              className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              <Icon name="person_check" className="text-[18px]" /> Reativar
            </button>
          ) : (
            <button
              onClick={() => setConfirmDeactivate(true)}
              className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              <Icon name="person_off" className="text-[18px]" /> Desativar
            </button>
          )}
          {!isVago && !isInativo && (
            <a
              href={whatsappUrl(morador.contato, `Olá, ${morador.nome.split(" ")[0]}!`)}
              target="_blank"
              rel="noreferrer"
              title="Conversar no WhatsApp"
              aria-label={`Enviar WhatsApp para ${morador.nome}`}
              className="btn-press btn-press-active inline-flex transition hover:opacity-85"
            >
              <WhatsAppIcon className="h-10 w-10" />
            </a>
          )}
        </>
      }
    >
      {/* Hero */}
      <section className="card-elev mb-5 overflow-hidden rounded-2xl">
        <div className="relative bg-gradient-to-r from-[var(--color-navy-deep)] via-[var(--color-navy)] to-[var(--color-brand)] p-6 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 text-xl font-bold backdrop-blur">
                {initials(morador.nome)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                  {condo.nome} • {condo.cidade}
                </p>
                <h2 className="mt-0.5 text-2xl font-bold tracking-tight">
                  {morador.nome}
                </h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85">
                  <Icon
                    name={morador.endereco.tipo === "vertical" ? "apartment" : "house"}
                    className="text-[16px]"
                  />
                  {end.full}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_CLS[morador.status]}`}
              >
                {morador.status}
              </span>
              {morador.desde ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
                  <Icon name="event" className="text-[14px]" /> Desde {morador.desde}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Info strip */}
        <div className="grid grid-cols-2 divide-x divide-[var(--color-outline-variant)] border-t border-[var(--color-outline-variant)] md:grid-cols-4">
          <InfoBlock icon="call" label="Telefone" value={morador.contato} />
          <InfoBlock icon="mail" label="E-mail" value={morador.email ?? "—"} />
          <InfoBlock
            icon="local_parking"
            label="Vagas"
            value={String(morador.vagas)}
          />
          <InfoBlock icon="pets" label="Pets" value={String(morador.pets)} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main content */}
        <div className="space-y-5">
          {/* KPIs */}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Total de chamados" value={String(stats.total)} icon="assignment" tone="brand" />
            <KpiCard label="Em aberto" value={String(stats.abertos)} icon="pending_actions" tone="warn" />
            <KpiCard label="Resolvidos" value={String(stats.resolvidos)} icon="task_alt" tone="success" />
            <KpiCard label="Custos aprovados" value={`R$ ${stats.gasto.toLocaleString("pt-BR")}`} icon="payments" tone="navy" />
          </section>

          {/* Tabs */}
          <div className="card-elev overflow-hidden rounded-2xl">
            <div className="flex border-b border-[var(--color-outline-variant)] bg-[var(--color-surface-low)]">
              <TabBtn
                active={tab === "chamados"}
                onClick={() => setTab("chamados")}
                icon="pending_actions"
                label="Chamados em aberto"
                count={abertos.length}
              />
              <TabBtn
                active={tab === "historico"}
                onClick={() => setTab("historico")}
                icon="history"
                label="Histórico de resoluções"
                count={resolvidos.length}
              />
              <TabBtn
                active={tab === "unidade"}
                onClick={() => setTab("unidade")}
                icon="apartment"
                label="Sobre a unidade"
              />
            </div>

            <div className="p-4 md:p-5">
              {tab === "chamados" && (
                <ChamadosList items={abertos} empty="Sem chamados em aberto" />
              )}
              {tab === "historico" && (
                <ChamadosList
                  items={resolvidos}
                  empty="Nenhum chamado resolvido no histórico"
                  showResolved
                />
              )}
              {tab === "unidade" && <UnidadeInfo morador={morador} condoNome={condo.nome} />}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-5">
          <section className="card-elev rounded-2xl p-5">
            <h3 className="text-sm font-bold text-[var(--color-navy)]">
              Ações rápidas
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {!isVago && (
                <a
                  href={whatsappUrl(morador.contato)}
                  target="_blank"
                  rel="noreferrer"
                  title="Conversar no WhatsApp"
                  aria-label={`Enviar WhatsApp para ${morador.nome}`}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <WhatsAppIcon variant="glyph" className="h-[16px] w-[16px]" /> WhatsApp
                </a>
              )}
              {morador.email && (
                <a
                  href={`mailto:${morador.email}`}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-outline-variant)] py-2.5 text-xs font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
                >
                  <Icon name="mail" className="text-[14px]" /> E-mail
                </a>
              )}
              <Link
                to="/app/demandas/nova"
                search={{ moradorId: morador.id, condominioId: morador.condominioId }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-outline-variant)] py-2.5 text-xs font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
              >
                <Icon name="add_task" className="text-[14px]" /> Novo chamado
              </Link>
            </div>
          </section>

          <section className="card-elev rounded-2xl p-5">
            <h3 className="text-sm font-bold text-[var(--color-navy)]">
              Informações cadastrais
            </h3>
            <dl className="mt-3 space-y-2 text-xs">
              <SidebarRow label="CPF" value={morador.cpf ?? "—"} icon="badge" />
              <SidebarRow
                label="Tipo de imóvel"
                value={morador.endereco.tipo === "vertical" ? "Apartamento" : "Casa"}
                icon={morador.endereco.tipo === "vertical" ? "apartment" : "house"}
              />
              <SidebarRow label="Condomínio" value={condo.nome} icon="domain" />
              <SidebarRow label="Cidade" value={condo.cidade} icon="place" />
            </dl>
          </section>

          {chamados.length > 0 && (
            <section className="card-elev rounded-2xl p-5">
              <h3 className="text-sm font-bold text-[var(--color-navy)]">
                Insights
              </h3>
              <ul className="mt-3 space-y-2 text-xs text-[var(--color-on-surface-variant)]">
                <li className="flex items-start gap-2">
                  <Icon
                    name="insights"
                    className="mt-0.5 text-[14px] text-[var(--color-brand)]"
                  />
                  Categoria mais frequente:{" "}
                  <span className="font-semibold text-[var(--color-navy)]">
                    {mostFrequent(chamados.map((c) => c.category))}
                  </span>
                </li>
                {stats.criticos > 0 && (
                  <li className="flex items-start gap-2">
                    <Icon
                      name="priority_high"
                      className="mt-0.5 text-[14px] text-red-600"
                    />
                    <span>
                      {stats.criticos} chamado{stats.criticos > 1 ? "s" : ""} crítico
                      {stats.criticos > 1 ? "s" : ""} no histórico
                    </span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <Icon
                    name="schedule"
                    className="mt-0.5 text-[14px] text-[var(--color-brand)]"
                  />
                  Última interação: {morador.ultimo}
                </li>
              </ul>
            </section>
          )}
        </aside>
      </div>

      <EditMoradorModal
        open={showEdit}
        morador={morador}
        onClose={() => setShowEdit(false)}
        onSaved={() => flash("Alterações salvas.")}
      />

      <ConfirmDialog
        open={confirmDeactivate}
        title={`Desativar ${morador.nome}?`}
        description="O morador será movido para a lista de arquivados e deixará de aparecer na listagem principal. Você poderá reativá-lo depois."
        confirmLabel="Desativar"
        tone="warn"
        icon="person_off"
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={() => {
          deactivateMorador(morador.id);
          setConfirmDeactivate(false);
          flash(`${morador.nome} foi desativado.`);
          router.invalidate();
        }}
      />

      <ConfirmDialog
        open={confirmReactivate}
        title={`Reativar ${morador.nome}?`}
        description="O morador voltará a aparecer na listagem principal como Residente."
        confirmLabel="Reativar"
        tone="brand"
        icon="person_check"
        onClose={() => setConfirmReactivate(false)}
        onConfirm={() => {
          reactivateMorador(morador.id);
          setConfirmReactivate(false);
          flash(`${morador.nome} foi reativado.`);
          router.invalidate();
        }}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-[var(--color-navy)] px-4 py-3 text-sm font-semibold text-white shadow-lg">
          <Icon name="check_circle" className="text-[18px]" filled />
          {toast}
        </div>
      )}
    </AppShell>
  );
}

/* -------- subcomponents -------- */

function InfoBlock({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
        <Icon name={icon} className="text-[14px]" /> {label}
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-[var(--color-navy)]">
        {value}
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: string;
  tone: "brand" | "warn" | "success" | "navy";
}) {
  const toneCls = {
    brand: "bg-[var(--color-brand)]/10 text-[var(--color-brand)]",
    warn: "bg-amber-50 text-amber-700",
    success: "bg-emerald-50 text-emerald-700",
    navy: "bg-[var(--color-navy)]/5 text-[var(--color-navy)]",
  }[tone];
  return (
    <div className="card-elev rounded-xl p-4">
      <div className={`inline-grid h-9 w-9 place-items-center rounded-lg ${toneCls}`}>
        <Icon name={icon} className="text-[18px]" />
      </div>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
        {label}
      </p>
      <p className="text-2xl font-bold text-[var(--color-navy)]">{value}</p>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
        active
          ? "border-[var(--color-brand)] bg-white text-[var(--color-brand)]"
          : "border-transparent text-[var(--color-on-surface-variant)] hover:text-[var(--color-navy)]"
      }`}
    >
      <Icon name={icon} className="text-[16px]" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{label.split(" ")[0]}</span>
      {typeof count === "number" && (
        <span
          className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            active
              ? "bg-[var(--color-brand)] text-white"
              : "bg-[var(--color-surface-mid)] text-[var(--color-on-surface-variant)]"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ChamadosList({
  items,
  empty,
  showResolved,
}: {
  items: Demanda[];
  empty: string;
  showResolved?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-outline-variant)] py-10 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--color-surface-mid)] text-[var(--color-on-surface-variant)]">
          <Icon name="inbox" />
        </div>
        <p className="mt-3 text-sm font-semibold text-[var(--color-navy)]">{empty}</p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((c) => (
        <li key={c.id}>
          <Link
            to="/app/demandas/$id"
            params={{ id: c.id }}
            preload="intent"
            className="group flex items-center gap-3 rounded-xl border border-[var(--color-outline-variant)] bg-white p-3 transition hover:-translate-y-0.5 hover:border-[var(--color-brand)] hover:shadow-sm"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-mid)] text-[var(--color-navy)]">
              <Icon name={CAT_ICON[c.category]} className="text-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-semibold text-[var(--color-on-surface-variant)]">
                  {c.id}
                </span>
                <span
                  className={`rounded-full border px-1.5 py-0 text-[9px] font-semibold ${PRIO_CLASS[c.priority]}`}
                >
                  {c.priority}
                </span>
                {showResolved && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0 text-[9px] font-semibold text-emerald-700">
                    <Icon name="check_circle" className="text-[10px]" filled /> Resolvido
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-sm font-semibold text-[var(--color-navy)] group-hover:text-[var(--color-brand)]">
                {c.title}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--color-on-surface-variant)]">
                <Icon name="event" className="text-[12px]" /> {c.createdAt}
                {c.cost?.approved ? (
                  <>
                    <span>•</span>
                    <Icon name="payments" className="text-[12px]" />R${" "}
                    {c.cost.approved.toLocaleString("pt-BR")}
                  </>
                ) : null}
              </p>
            </div>
            <Icon
              name="chevron_right"
              className="text-[20px] text-[var(--color-on-surface-variant)] group-hover:text-[var(--color-brand)]"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function UnidadeInfo({ morador, condoNome }: { morador: Morador; condoNome: string }) {
  const e = morador.endereco;
  const rows =
    e.tipo === "vertical"
      ? [
          { label: "Tipo", value: "Vertical (apartamento)", icon: "apartment" },
          { label: "Bloco / Torre", value: e.bloco, icon: "domain" },
          { label: "Andar", value: `${e.andar}º andar`, icon: "stairs" },
          { label: "Apartamento", value: e.apto, icon: "meeting_room" },
        ]
      : [
          { label: "Tipo", value: "Horizontal (casa)", icon: "house" },
          { label: "Quadra", value: e.quadra, icon: "grid_view" },
          { label: "Casa", value: e.casa, icon: "meeting_room" },
        ];
  return (
    <div>
      <div className="mb-4 rounded-xl bg-[var(--color-surface-low)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
          Endereço completo
        </p>
        <p className="mt-1 text-sm font-semibold text-[var(--color-navy)]">
          {condoNome} — {formatEndereco(e).full}
        </p>
      </div>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center gap-3 rounded-lg border border-[var(--color-outline-variant)] p-3"
          >
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
              <Icon name={r.icon} className="text-[18px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                {r.label}
              </p>
              <p className="truncate text-sm font-semibold text-[var(--color-navy)]">
                {r.value}
              </p>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SidebarRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex items-center gap-1.5 text-[var(--color-on-surface-variant)]">
        <Icon name={icon} className="text-[14px]" /> {label}
      </dt>
      <dd className="truncate text-right font-semibold text-[var(--color-navy)]">
        {value}
      </dd>
    </div>
  );
}

function mostFrequent<T extends string>(arr: T[]): string {
  if (arr.length === 0) return "—";
  const counts = new Map<T, number>();
  for (const x of arr) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function MoradorError({ error }: ErrorComponentProps) {
  return (
    <AppShell title="Erro">
      <div className="card-elev mx-auto max-w-lg rounded-2xl p-8 text-center">
        <Icon name="error" className="text-[40px] text-red-600" />
        <h2 className="mt-2 text-lg font-bold text-[var(--color-navy)]">
          Não foi possível carregar o morador
        </h2>
        <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
          {error instanceof Error ? error.message : String(error)}
        </p>
      </div>
    </AppShell>
  );
}

function MoradorNotFound() {
  const { id } = Route.useParams();
  return (
    <AppShell title="Morador não encontrado">
      <div className="card-elev mx-auto max-w-lg rounded-2xl p-8 text-center">
        <Icon name="person_off" className="text-[40px] text-[var(--color-on-surface-variant)]" />
        <h2 className="mt-2 text-lg font-bold text-[var(--color-navy)]">
          Morador não encontrado
        </h2>
        <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
          Nenhum registro para o ID <span className="font-mono">{id}</span>.
        </p>
        <Link
          to="/app/moradores"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-xs font-semibold text-white"
        >
          <Icon name="arrow_back" className="text-[14px]" /> Voltar aos moradores
        </Link>
      </div>
    </AppShell>
  );
}
