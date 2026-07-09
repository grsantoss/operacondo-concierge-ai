import { useEffect, useState } from "react";
import { Icon } from "@/components/brand/Icon";
import {
  CRITERIOS_HOMOLOGACAO,
  homologarSupplier,
  isObrigatoriosOk,
  toggleCriterio,
  useSuppliers,
} from "@/data/fornecedores";

interface Props {
  open: boolean;
  supplierId: string | null;
  onClose: () => void;
  onHomologado?: (nome: string) => void;
}

export function HomologacoesModal({ open, supplierId, onClose, onHomologado }: Props) {
  const suppliers = useSuppliers();
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (open) {
      setSelectedId(supplierId ?? suppliers[0]?.id ?? "");
    }
  }, [open, supplierId, suppliers]);

  if (!open) return null;

  const supplier = suppliers.find((s) => s.id === selectedId) ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[var(--color-outline-variant)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
              <Icon name="fact_check" className="text-[20px]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--color-navy)]">
                Homologações de fornecedores
              </h2>
              <p className="text-xs text-[var(--color-on-surface-variant)]">
                Marque os critérios atendidos para homologar cada fornecedor.
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

        <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[220px_1fr]">
          <aside className="border-r border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] p-3 md:overflow-y-auto">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
              Fornecedores
            </p>
            <ul className="space-y-1">
              {suppliers.map((s) => {
                const ok = isObrigatoriosOk(s);
                const active = s.id === selectedId;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelectedId(s.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold ${
                        active ? "bg-white text-[var(--color-navy)] shadow-sm" : "text-[var(--color-on-surface-variant)] hover:bg-white"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          ok ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      <span className="truncate">{s.nome}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <div className="overflow-y-auto p-5">
            {!supplier ? (
              <p className="text-sm text-[var(--color-on-surface-variant)]">
                Selecione um fornecedor.
              </p>
            ) : (
              <>
                <div className="mb-4 flex items-start justify-between gap-3 rounded-xl bg-[var(--color-surface-low)] p-4">
                  <div>
                    <p className="text-sm font-bold text-[var(--color-navy)]">{supplier.nome}</p>
                    <p className="text-xs text-[var(--color-on-surface-variant)]">
                      {supplier.categoria} · {supplier.cnpj}
                    </p>
                    {supplier.homologacao.validoAte && (
                      <p className="mt-1 text-[11px] text-[var(--color-on-surface-variant)]">
                        Válido até <strong>{supplier.homologacao.validoAte}</strong>
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      supplier.estado === "Homologado"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : supplier.estado === "Renovação"
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : supplier.estado === "Em análise"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-slate-200 bg-slate-100 text-slate-600"
                    }`}
                  >
                    {supplier.estado}
                  </span>
                </div>

                <ul className="space-y-2">
                  {CRITERIOS_HOMOLOGACAO.map((c) => {
                    const checked = supplier.homologacao.criteriosOk.includes(c.id);
                    return (
                      <li
                        key={c.id}
                        className="flex items-start gap-3 rounded-lg border border-[var(--color-outline-variant)] p-3"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCriterio(supplier.id, c.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-[var(--color-navy)]">
                              {c.label}
                            </p>
                            {c.obrigatorio && (
                              <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-700">
                                Obrigatório
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--color-on-surface-variant)]">
                            {c.descricao}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-5 flex items-center justify-between rounded-xl bg-[var(--color-surface-low)] p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                      Status geral
                    </p>
                    <p className="text-sm font-bold text-[var(--color-navy)]">
                      {supplier.homologacao.criteriosOk.length} de {CRITERIOS_HOMOLOGACAO.length} critérios ·{" "}
                      {isObrigatoriosOk(supplier) ? "obrigatórios OK" : "pendências obrigatórias"}
                    </p>
                  </div>
                  <button
                    disabled={!isObrigatoriosOk(supplier)}
                    onClick={() => {
                      homologarSupplier(supplier.id);
                      onHomologado?.(supplier.nome);
                    }}
                    className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Icon name="verified" className="text-[18px]" /> Marcar como homologado
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
