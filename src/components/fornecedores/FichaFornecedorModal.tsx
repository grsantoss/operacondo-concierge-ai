import { useState } from "react";
import { Icon } from "@/components/brand/Icon";
import {
  CRITERIOS_HOMOLOGACAO,
  isObrigatoriosOk,
  useFornecedoresAcoes,
  type Doc,
  type Supplier,
} from "@/data/fornecedores";

const TIPOS_DOC: { id: Doc["kind"]; label: string }[] = [
  { id: "cnpj", label: "Cartão CNPJ" },
  { id: "contrato", label: "Contrato" },
  { id: "certidao", label: "Certidão" },
  { id: "apolice", label: "Apólice de seguro" },
  { id: "art", label: "ART" },
  { id: "outro", label: "Outro" },
];

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
        className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-elevated"
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
              {supplier.contatoNome ? <Info label="Contato" value={supplier.contatoNome} /> : null}
            </dl>
            {supplier.observacoes ? (
              <p className="mt-2 whitespace-pre-line rounded-xl bg-[var(--color-surface-low)] p-3 text-xs text-[var(--color-on-surface-variant)]">
                {supplier.observacoes}
              </p>
            ) : null}
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
                      ? "bg-success/10 text-success-strong"
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
              <ul className="mb-3 space-y-2">
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
                    {d.url ? (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir documento"
                        className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
                      >
                        <Icon name="download" className="text-[18px]" />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <EnviarDocumento fornecedorId={supplier.id} />
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
            className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow-soft hover:bg-[var(--color-brand-hover)]"
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

/** Envio de documento do fornecedor (PDF ou imagem, até 20 MB) para o S3. */
function EnviarDocumento({ fornecedorId }: { fornecedorId: string }) {
  const { enviarDocumento } = useFornecedoresAcoes();
  const [tipo, setTipo] = useState<Doc["kind"]>("certidao");
  const [validoAte, setValidoAte] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [estado, setEstado] = useState<{ enviando?: boolean; erro?: string; ok?: string }>({});

  async function enviar() {
    if (!arquivo) return;
    setEstado({ enviando: true });
    try {
      await enviarDocumento(fornecedorId, arquivo, tipo, validoAte || undefined);
      setEstado({ ok: `${arquivo.name} enviado.` });
      setArquivo(null);
      setValidoAte("");
    } catch (err) {
      setEstado({ erro: (err as Error).message });
    }
  }

  const campo =
    "h-9 rounded-lg border border-[var(--color-outline-variant)] bg-white px-2 text-xs text-[var(--color-navy)]";
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-outline-variant)] p-3">
      <p className="mb-2 text-xs font-semibold text-[var(--color-navy)]">Enviar documento</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          type="file"
          aria-label="Arquivo do documento"
          accept="application/pdf,image/*"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          className="min-w-0 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-[var(--color-surface-mid)] file:px-2 file:py-1.5 file:text-xs file:font-semibold"
        />
        <select
          aria-label="Tipo do documento"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as Doc["kind"])}
          className={campo}
        >
          {TIPOS_DOC.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-[var(--color-on-surface-variant)]">
          Válido até
          <input
            type="date"
            value={validoAte}
            onChange={(e) => setValidoAte(e.target.value)}
            className={campo}
          />
        </label>
        <button
          type="button"
          onClick={enviar}
          disabled={!arquivo || estado.enviando}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-brand)] px-3 text-xs font-semibold text-white hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="upload" className="text-[16px]" />
          {estado.enviando ? "Enviando…" : "Enviar"}
        </button>
      </div>
      {estado.erro ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {estado.erro}
        </p>
      ) : null}
      {estado.ok ? <p className="mt-2 text-xs text-success-strong">{estado.ok}</p> : null}
    </div>
  );
}
