import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";
import { ConfirmDialog } from "@/components/moradores/ConfirmDialog";
import { EditSupplierModal } from "@/components/fornecedores/EditSupplierModal";
import { FichaFornecedorModal } from "@/components/fornecedores/FichaFornecedorModal";
import { HomologacoesModal } from "@/components/fornecedores/HomologacoesModal";
import { SupplierCardMenu } from "@/components/fornecedores/SupplierCardMenu";
import {
  INITIAL_FILTERS,
  SuppliersFilters,
  type FiltersState,
} from "@/components/fornecedores/SuppliersFilters";
import {
  arquivarSupplier,
  useSuppliers,
  whatsappUrl,
  type Estado,
  type Supplier,
} from "@/data/fornecedores";

export const Route = createFileRoute("/app/fornecedores/")({
  head: () => ({ meta: [{ title: "Fornecedores | Concierge OperaCondo" }] }),
  component: FornecedoresPage,
});

const ESTADO_CLS: Record<Estado, string> = {
  Homologado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Em análise": "bg-amber-50 text-amber-700 border-amber-200",
  Renovação: "bg-blue-50 text-blue-700 border-blue-200",
  Inativo: "bg-slate-100 text-slate-600 border-slate-200",
};

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function FornecedoresPage() {
  const suppliers = useSuppliers();
  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS);
  const [homolOpen, setHomolOpen] = useState(false);
  const [homolSupplierId, setHomolSupplierId] = useState<string | null>(null);
  const [fichaSupplier, setFichaSupplier] = useState<Supplier | null>(null);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Supplier | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }

  const counts = useMemo(() => {
    const c: Record<Estado, number> = { "Homologado": 0, "Em análise": 0, "Renovação": 0, "Inativo": 0 };
    suppliers.forEach((s) => { c[s.estado]++; });
    return c;
  }, [suppliers]);

  const categorias = useMemo(
    () => Array.from(new Set(suppliers.map((s) => s.categoria))).sort(),
    [suppliers],
  );

  const filtered = useMemo(() => {
    const q = normalize(filters.q.trim());
    let list = suppliers.filter((s) => {
      if (filters.estados.length && !filters.estados.includes(s.estado)) return false;
      if (filters.categoria !== "all" && s.categoria !== filters.categoria) return false;
      if (s.rating < filters.ratingMin) return false;
      if (filters.apenasRecentes && s.ultimos <= 0) return false;
      if (!q) return true;
      return (
        normalize(s.nome).includes(q) ||
        normalize(s.cnpj).includes(q) ||
        normalize(s.categoria).includes(q) ||
        normalize(s.contato).includes(q) ||
        normalize(s.email).includes(q)
      );
    });
    list = [...list].sort((a, b) => {
      switch (filters.sort) {
        case "rating": return b.rating - a.rating;
        case "servicos": return b.ultimos - a.ultimos;
        case "estado": return a.estado.localeCompare(b.estado);
        default: return a.nome.localeCompare(b.nome);
      }
    });
    return list;
  }, [suppliers, filters]);

  const hasActive =
    filters.q.trim() !== "" ||
    filters.estados.length > 0 ||
    filters.categoria !== "all" ||
    filters.ratingMin !== 0 ||
    filters.apenasRecentes ||
    filters.sort !== "nome";

  return (
    <AppShell
      title="Fornecedores"
      breadcrumbs={[{ label: "OperaCondo" }, { label: "Fornecedores" }]}
      actions={
        <>
          <button
            onClick={() => { setHomolSupplierId(null); setHomolOpen(true); }}
            className="btn-press btn-press-active hidden h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)] sm:inline-flex"
          >
            <Icon name="fact_check" className="text-[18px]" /> Homologações
          </button>
          <Link
            to="/app/fornecedores/novo"
            className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)]"
          >
            <Icon name="add_business" className="text-[18px]" /> Cadastrar fornecedor
          </Link>
        </>
      }
    >
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {([
          { l: "Homologados", v: counts.Homologado, i: "verified", t: "text-emerald-700 bg-emerald-50" },
          { l: "Em análise", v: counts["Em análise"], i: "pending", t: "text-amber-700 bg-amber-50" },
          { l: "Renovação", v: counts.Renovação, i: "autorenew", t: "text-blue-700 bg-blue-50" },
          { l: "Categorias", v: categorias.length, i: "category", t: "text-violet-700 bg-violet-50" },
        ]).map((s) => (
          <div key={s.l} className="card-elev rounded-xl p-4">
            <div className={`inline-grid h-9 w-9 place-items-center rounded-lg ${s.t}`}>
              <Icon name={s.i} className="text-[18px]" />
            </div>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
              {s.l}
            </p>
            <p className="text-2xl font-bold text-[var(--color-navy)]">{s.v}</p>
          </div>
        ))}
      </section>

      <SuppliersFilters
        filters={filters}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        onReset={() => setFilters(INITIAL_FILTERS)}
        counts={counts}
        categorias={categorias}
        hasActive={hasActive}
      />

      {filtered.length === 0 ? (
        <div className="card-elev flex flex-col items-center rounded-2xl px-6 py-16 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-surface-mid)] text-[var(--color-on-surface-variant)]">
            <Icon name="search_off" />
          </div>
          <p className="mt-3 text-sm font-semibold text-[var(--color-navy)]">
            Nenhum fornecedor corresponde aos filtros
          </p>
          <button
            onClick={() => setFilters(INITIAL_FILTERS)}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-xs font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
          >
            <Icon name="close" className="text-[14px]" /> Limpar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <SupplierCard
              key={s.id}
              s={s}
              onFicha={() => setFichaSupplier(s)}
              onEdit={() => setEditSupplier(s)}
              onHomologar={() => { setHomolSupplierId(s.id); setHomolOpen(true); }}
              onArquivar={() => setConfirmArchive(s)}
              onCopyCnpj={() => {
                void navigator.clipboard?.writeText(s.cnpj);
                flash("CNPJ copiado para a área de transferência.");
              }}
              onHistorico={() => flash("Histórico de serviços em breve.")}
            />
          ))}
        </div>
      )}

      <HomologacoesModal
        open={homolOpen}
        supplierId={homolSupplierId}
        onClose={() => setHomolOpen(false)}
        onHomologado={(nome) => flash(`${nome} homologado com sucesso.`)}
      />

      <FichaFornecedorModal
        open={!!fichaSupplier}
        supplier={fichaSupplier}
        onClose={() => setFichaSupplier(null)}
        onEdit={() => {
          const s = fichaSupplier;
          setFichaSupplier(null);
          setEditSupplier(s);
        }}
        onOpenHomologacao={() => {
          if (fichaSupplier) {
            setHomolSupplierId(fichaSupplier.id);
            setFichaSupplier(null);
            setHomolOpen(true);
          }
        }}
      />

      <EditSupplierModal
        open={!!editSupplier}
        supplier={editSupplier}
        onClose={() => setEditSupplier(null)}
        onSaved={() => flash("Fornecedor atualizado.")}
      />

      <ConfirmDialog
        open={!!confirmArchive}
        title="Arquivar fornecedor?"
        description={
          confirmArchive
            ? `${confirmArchive.nome} será movido para o estado "Inativo" e deixará de aparecer nas listagens ativas.`
            : ""
        }
        confirmLabel="Arquivar"
        icon="inventory_2"
        tone="warn"
        onConfirm={() => {
          if (!confirmArchive) return;
          arquivarSupplier(confirmArchive.id);
          flash(`${confirmArchive.nome} arquivado.`);
          setConfirmArchive(null);
        }}
        onClose={() => setConfirmArchive(null)}
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

interface SupplierCardProps {
  s: Supplier;
  onFicha: () => void;
  onEdit: () => void;
  onHomologar: () => void;
  onArquivar: () => void;
  onCopyCnpj: () => void;
  onHistorico: () => void;
}

function SupplierCard({ s, onFicha, onEdit, onHomologar, onArquivar, onCopyCnpj, onHistorico }: SupplierCardProps) {
  const waMsg = `Olá ${s.nome.split(" ")[0]}, aqui é do condomínio OperaCondo sobre serviços da categoria ${s.categoria}...`;
  const waHref = whatsappUrl(s.contato, waMsg);
  return (
    <article className="card-elev group rounded-2xl p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--color-navy)] text-white">
            <Icon name="storefront" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-[var(--color-navy)]">
              {s.nome}
            </h3>
            <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
              {s.categoria}
            </p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ESTADO_CLS[s.estado]}`}>
          {s.estado}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[var(--color-surface-low)] p-3 text-center">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-on-surface-variant)]">Rating</p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-bold text-[var(--color-navy)]">
            <Icon name="star" className="text-[14px] text-amber-500" filled />
            {s.rating.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-on-surface-variant)]">Serviços</p>
          <p className="mt-0.5 text-sm font-bold text-[var(--color-navy)]">{s.ultimos}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-on-surface-variant)]">CNPJ</p>
          <p className="mt-0.5 truncate font-mono text-[10px] font-semibold text-[var(--color-navy)]">
            {s.cnpj.slice(0, 10)}…
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          title={`Enviar WhatsApp para ${s.nome}`}
          aria-label={`WhatsApp ${s.nome}`}
          className="btn-press btn-press-active grid h-10 w-10 place-items-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Icon name="chat" className="text-[18px]" filled />
        </a>
        <button
          onClick={onFicha}
          title="Ver ficha do fornecedor"
          aria-label={`Ver ficha de ${s.nome}`}
          className="btn-press btn-press-active grid h-10 w-10 place-items-center rounded-lg border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-low)]"
        >
          <Icon name="description" className="text-[18px]" />
        </button>
        <SupplierCardMenu
          actions={[
            { label: "Editar fornecedor", icon: "edit", onClick: onEdit },
            { label: "Ver ficha completa", icon: "description", onClick: onFicha },
            { label: "Solicitar homologação", icon: "fact_check", onClick: onHomologar },
            { label: "Copiar CNPJ", icon: "content_copy", onClick: onCopyCnpj },
            { label: "Histórico de serviços", icon: "history", onClick: onHistorico },
            { label: "Arquivar fornecedor", icon: "inventory_2", onClick: onArquivar, tone: "danger", divider: true },
          ]}
        />
        <div className="ml-auto flex-1" />
      </div>
    </article>
  );
}
