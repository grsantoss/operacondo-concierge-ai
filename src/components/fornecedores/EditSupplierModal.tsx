import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/brand/Icon";
import {
  CATEGORIAS,
  updateSupplier,
  type Estado,
  type Supplier,
} from "@/data/fornecedores";

const ESTADOS: Estado[] = ["Homologado", "Em análise", "Renovação", "Inativo"];

interface Props {
  open: boolean;
  supplier: Supplier | null;
  onClose: () => void;
  onSaved?: () => void;
}

type FormState = {
  nome: string;
  categoria: string;
  cnpj: string;
  contato: string;
  email: string;
  estado: Estado;
  rating: string;
};

export function EditSupplierModal({ open, supplier, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && supplier) {
      setForm({
        nome: supplier.nome,
        categoria: supplier.categoria,
        cnpj: supplier.cnpj,
        contato: supplier.contato,
        email: supplier.email,
        estado: supplier.estado,
        rating: String(supplier.rating),
      });
      setError(null);
    }
  }, [open, supplier]);

  if (!open || !supplier || !form) return null;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form || !supplier) return;
    if (!form.nome.trim()) return setError("Nome é obrigatório.");
    if (!form.cnpj.trim()) return setError("CNPJ é obrigatório.");
    const rating = Number(form.rating);
    if (Number.isNaN(rating) || rating < 0 || rating > 5)
      return setError("Rating deve ser entre 0 e 5.");
    updateSupplier(supplier.id, {
      nome: form.nome.trim(),
      categoria: form.categoria,
      cnpj: form.cnpj.trim(),
      contato: form.contato.trim(),
      email: form.email.trim(),
      estado: form.estado,
      rating,
    });
    onSaved?.();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[var(--color-outline-variant)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
              <Icon name="edit" className="text-[20px]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--color-navy)]">Editar fornecedor</h2>
              <p className="text-xs text-[var(--color-on-surface-variant)]">Atualize os dados cadastrais.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="grid max-h-[70vh] grid-cols-1 gap-4 overflow-y-auto px-6 py-5 md:grid-cols-2">
          <Field label="Nome" required>
            <input value={form.nome} onChange={(e) => set("nome", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Categoria">
            <select value={form.categoria} onChange={(e) => set("categoria", e.target.value)} className={inputCls}>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="CNPJ" required>
            <input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Telefone / WhatsApp">
            <input value={form.contato} onChange={(e) => set("contato", e.target.value)} className={inputCls} />
          </Field>
          <Field label="E-mail">
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Estado">
            <select value={form.estado} onChange={(e) => set("estado", e.target.value as Estado)} className={inputCls}>
              {ESTADOS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Rating (0-5)">
            <input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={(e) => set("rating", e.target.value)} className={inputCls} />
          </Field>

          {error && (
            <p className="md:col-span-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              <Icon name="error" className="text-[16px]" /> {error}
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)]"
          >
            <Icon name="save" className="text-[18px]" /> Salvar
          </button>
        </footer>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 py-2 text-sm text-[var(--color-navy)] outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}
