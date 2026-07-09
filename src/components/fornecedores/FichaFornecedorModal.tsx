import { Icon } from "@/components/brand/Icon";
import {
  CRITERIOS_HOMOLOGACAO,
  isObrigatoriosOk,
  type Supplier,
} from "@/data/fornecedores";

interface Props {
  open: boolean;
  supplier: Supplier | null;
  onClose: () => void;
  onEdit: () => void;
  onOpenHomologacao: () => void;
}

const KIND_ICON: Record<string, string> = {
  cnpj: "badge",
  contrato: "gavel",
  certidao: "verified",
  apolice: "shield",
  art: "engineering",
  outro: "description",
};

export function FichaFornecedorModal({ open, supplier, onClose, onEdit, onOpenHomologacao }: Props) {
  if (!open || !supplier) return null;
  const total = CRITERIOS_HOMOLOGACAO.length;
  const okCount = supplier.homologacao.criteriosOk.length;
  const percent = Math.round((okCount / total) * 100);
  const okObrig = isObrigatoriosOk(supplier);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-outline-variant)] bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--color-navy)] text-white">
              <Icon name="storefront" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-[var(--color-navy)]">
                {supplier.nome}
              </h2>
              <p className="text-xs text-[var(--color-on-surface-variant)]">
                {supplier.categoria}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="space-y-5 px-6 py-5">
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
              Dados cadastrais
            </h3>
            <dl className="grid grid-cols-2 gap-3 rounded-xl bg-[var(--color-surface-low)] p-3 text-sm">
              <Info label="CNPJ" value={supplier.cnpj} mono />
              <Info label="Telefone" value={supplier.contato} />
              <Info label="E-mail" value={supplier.email} />
              <Info label="Serviços" value={String(supplier.ultimos)} />
              <Info label="Rating" value={supplier.rating.toFixed(1)} />
              <Info label="Estado" value={supplier.estado} />
            </dl>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                Homologação
              </h3>
              <button
                onClick={onOpenHomologacao}
                className="text-xs font-semibold text-[var(--color-brand)] hover:underline"
              >
                Abrir checklist →
              </button>
            </div>
            <div className="rounded-xl border border-[var(--color-outline-variant)] p-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--color-navy)]">
                  {okCount} de {total} critérios
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    okObrig
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {okObrig ? "Obrigatórios OK" : "Pendências obrigatórias"}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-mid)]">
                <div
                  className="h-full bg-[var(--color-brand)]"
                  style={{ width: `${percent}%` }}
                />
              </div>
              {supplier.homologacao.validoAte && (
                <p className="mt-2 text-[11px] text-[var(--color-on-surface-variant)]">
                  Válido até <strong className="text-[var(--color-navy)]">{supplier.homologacao.validoAte}</strong>
                </p>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
              Documentos ({supplier.docs.length})
            </h3>
            {supplier.docs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--color-outline-variant)] p-4 text-center text-xs text-[var(--color-on-surface-variant)]">
                Nenhum documento anexado.
              </p>
            ) : (
              <ul className="space-y-2">
                {supplier.docs.map((d) => (
                  <li
                    key={d.name}
                    className="flex items-center gap-3 rounded-lg border border-[var(--color-outline-variant)] p-3"
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                      <Icon name={KIND_ICON[d.kind] ?? "description"} className="text-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--color-navy)]">
                        {d.name}
                      </p>
                      <p className="text-[11px] text-[var(--color-on-surface-variant)]">
                        Enviado em {d.uploadedAt}
                        {d.validUntil ? ` · Válido até ${d.validUntil}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] px-6 py-3">
          <button
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
          >
            Fechar
          </button>
          <button
            onClick={onEdit}
            className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)]"
          >
            <Icon name="edit" className="text-[18px]" /> Editar
          </button>
        </footer>
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
        {label}
      </dt>
      <dd className={`text-sm font-semibold text-[var(--color-navy)] ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
