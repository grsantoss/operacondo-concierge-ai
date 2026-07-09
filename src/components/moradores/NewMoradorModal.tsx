import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/brand/Icon";
import {
  addMoradores,
  CONDOMINIOS,
  getMoradoresSnapshot,
  STATUS_LIST,
  type Endereco,
  type Status,
} from "@/data/moradores";

interface Props {
  open: boolean;
  defaultCondominioId?: string;
  onClose: () => void;
  onCreated?: (nome: string) => void;
}

type FormState = {
  nome: string;
  cpf: string;
  email: string;
  contato: string;
  condominioId: string;
  tipoEndereco: "vertical" | "horizontal";
  bloco: string;
  andar: string;
  apto: string;
  quadra: string;
  casa: string;
  status: Status;
  vagas: string;
  pets: string;
  desde: string;
};

function initial(condoId?: string): FormState {
  const first = CONDOMINIOS[0];
  const cid = condoId && condoId !== "all" ? condoId : first.id;
  const condo = CONDOMINIOS.find((c) => c.id === cid) ?? first;
  return {
    nome: "",
    cpf: "",
    email: "",
    contato: "",
    condominioId: condo.id,
    tipoEndereco: condo.tipo,
    bloco: "",
    andar: "",
    apto: "",
    quadra: "",
    casa: "",
    status: "Residente",
    vagas: "1",
    pets: "0",
    desde: "",
  };
}

function nextId(): string {
  const nums = getMoradoresSnapshot()
    .map((m) => Number(m.id.replace(/^m/, "")))
    .filter((n) => !Number.isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `m${max + 1}`;
}

export function NewMoradorModal({ open, defaultCondominioId, onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormState>(() => initial(defaultCondominioId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial(defaultCondominioId));
      setError(null);
    }
  }, [open, defaultCondominioId]);

  if (!open) return null;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return setError("Nome é obrigatório.");
    if (form.status !== "Vago" && !form.contato.trim())
      return setError("Contato é obrigatório.");

    let endereco: Endereco;
    if (form.tipoEndereco === "vertical") {
      if (!form.bloco.trim() || !form.andar.trim() || !form.apto.trim())
        return setError("Bloco, andar e apto são obrigatórios.");
      const andar = Number(form.andar);
      if (Number.isNaN(andar)) return setError("Andar deve ser um número.");
      endereco = { tipo: "vertical", bloco: form.bloco.trim(), andar, apto: form.apto.trim() };
    } else {
      if (!form.quadra.trim() || !form.casa.trim())
        return setError("Quadra e casa são obrigatórios.");
      endereco = { tipo: "horizontal", quadra: form.quadra.trim(), casa: form.casa.trim() };
    }

    const nome = form.nome.trim();
    addMoradores([
      {
        id: nextId(),
        nome,
        condominioId: form.condominioId,
        endereco,
        status: form.status,
        vagas: Number(form.vagas) || 0,
        pets: Number(form.pets) || 0,
        contato: form.contato.trim() || "—",
        email: form.email.trim() || undefined,
        cpf: form.cpf.trim() || undefined,
        desde: form.desde.trim() || undefined,
        ultimo: "agora",
      },
    ]);
    onCreated?.(nome);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[var(--color-outline-variant)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
              <Icon name="person_add" className="text-[20px]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--color-navy)]">Novo morador</h2>
              <p className="text-xs text-[var(--color-on-surface-variant)]">
                Cadastre um morador manualmente.
              </p>
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

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Nome" required>
              <input value={form.nome} onChange={(e) => set("nome", e.target.value)} className={inputCls} />
            </Field>
            <Field label="CPF">
              <input value={form.cpf} onChange={(e) => set("cpf", e.target.value)} className={inputCls} />
            </Field>
            <Field label="E-mail">
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Contato (WhatsApp)" required={form.status !== "Vago"}>
              <input value={form.contato} onChange={(e) => set("contato", e.target.value)} className={inputCls} placeholder="+55 11 99999-0000" />
            </Field>
            <Field label="Condomínio">
              <select
                value={form.condominioId}
                onChange={(e) => {
                  const cid = e.target.value;
                  const condo = CONDOMINIOS.find((c) => c.id === cid);
                  setForm((f) => ({
                    ...f,
                    condominioId: cid,
                    tipoEndereco: condo?.tipo ?? f.tipoEndereco,
                  }));
                }}
                className={inputCls}
              >
                {CONDOMINIOS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tipo de imóvel">
              <select
                value={form.tipoEndereco}
                onChange={(e) => set("tipoEndereco", e.target.value as "vertical" | "horizontal")}
                className={inputCls}
              >
                <option value="vertical">Vertical (apartamento)</option>
                <option value="horizontal">Horizontal (casa)</option>
              </select>
            </Field>

            {form.tipoEndereco === "vertical" ? (
              <>
                <Field label="Bloco / Torre" required>
                  <input value={form.bloco} onChange={(e) => set("bloco", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Andar" required>
                  <input value={form.andar} onChange={(e) => set("andar", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Apartamento" required>
                  <input value={form.apto} onChange={(e) => set("apto", e.target.value)} className={inputCls} />
                </Field>
              </>
            ) : (
              <>
                <Field label="Quadra" required>
                  <input value={form.quadra} onChange={(e) => set("quadra", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Casa" required>
                  <input value={form.casa} onChange={(e) => set("casa", e.target.value)} className={inputCls} />
                </Field>
              </>
            )}

            <Field label="Status">
              <select value={form.status} onChange={(e) => set("status", e.target.value as Status)} className={inputCls}>
                {STATUS_LIST.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vagas">
              <input type="number" min={0} value={form.vagas} onChange={(e) => set("vagas", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Pets">
              <input type="number" min={0} value={form.pets} onChange={(e) => set("pets", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Morador desde">
              <input value={form.desde} placeholder="Ex.: Jan 2026" onChange={(e) => set("desde", e.target.value)} className={inputCls} />
            </Field>
          </div>

          {error && (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
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
            <Icon name="person_add" className="text-[18px]" /> Cadastrar morador
          </button>
        </footer>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 py-2 text-sm text-[var(--color-navy)] outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}
