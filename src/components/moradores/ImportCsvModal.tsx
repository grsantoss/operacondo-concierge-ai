import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Icon } from "@/components/brand/Icon";
import {
  CONDOMINIOS,
  CSV_HEADERS,
  addMoradores,
  downloadCsvTemplate,
  validateCsvRows,
  type CsvRow,
  type CsvValidationResult,
} from "@/data/moradores";

export function ImportCsvModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<CsvRow[] | null>(null);
  const [result, setResult] = useState<CsvValidationResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const preview = useMemo(() => (rows ?? []).slice(0, 5), [rows]);

  if (!open) return null;

  function reset() {
    setFileName(null);
    setRows(null);
    setResult(null);
    setParseError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleFile(file: File) {
    setParseError(null);
    setFileName(file.name);
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        if (res.errors.length) {
          setParseError(res.errors[0]?.message ?? "Falha ao ler CSV");
          return;
        }
        const parsed = res.data as CsvRow[];
        setRows(parsed);
        setResult(validateCsvRows(parsed));
      },
      error: (err) => setParseError(err.message),
    });
  }

  function confirmImport() {
    if (!result || result.valid.length === 0) return;
    addMoradores(result.valid);
    onImported(result.valid.length);
    reset();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-csv-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-outline-variant)] px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
              <Icon name="upload_file" />
            </div>
            <div>
              <h3 id="import-csv-title" className="text-sm font-bold text-[var(--color-navy)]">
                Importar moradores via CSV
              </h3>
              <p className="text-xs text-[var(--color-on-surface-variant)]">
                Envie a lista completa em um único arquivo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
            aria-label="Fechar"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-140px)] overflow-y-auto px-5 py-4">
          {!rows && (
            <>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFile(f);
                }}
                className={`grid place-items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
                  dragOver
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5"
                    : "border-[var(--color-outline-variant)]"
                }`}
              >
                <Icon name="cloud_upload" className="text-[36px] text-[var(--color-brand)]" />
                <p className="mt-2 text-sm font-semibold text-[var(--color-navy)]">
                  Arraste o arquivo CSV aqui
                </p>
                <p className="text-xs text-[var(--color-on-surface-variant)]">ou</p>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="btn-press btn-press-active mt-2 inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-xs font-semibold text-white hover:bg-[var(--color-brand-hover)]"
                >
                  <Icon name="folder_open" className="text-[16px]" /> Selecionar arquivo
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                {parseError && (
                  <p className="mt-3 text-xs text-red-600">Erro: {parseError}</p>
                )}
              </div>

              <div className="mt-4 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--color-navy)]">
                      Não sabe o formato?
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-on-surface-variant)]">
                      Baixe o modelo com as colunas obrigatórias e 2 linhas de exemplo.
                    </p>
                  </div>
                  <button
                    onClick={downloadCsvTemplate}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-xs font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
                  >
                    <Icon name="download" className="text-[14px]" /> Modelo CSV
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {CSV_HEADERS.map((h) => (
                    <code
                      key={h}
                      className="rounded bg-white px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-navy)]"
                    >
                      {h}
                    </code>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-[var(--color-on-surface-variant)]">
                  Condomínios aceitos:{" "}
                  {CONDOMINIOS.map((c) => (
                    <span key={c.id} className="font-semibold text-[var(--color-navy)]">
                      {c.nome}
                      {"; "}
                    </span>
                  ))}
                </p>
              </div>
            </>
          )}

          {rows && result && (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon name="description" className="text-[18px] text-[var(--color-brand)]" />
                  <p className="text-sm font-semibold text-[var(--color-navy)]">{fileName}</p>
                </div>
                <button
                  onClick={reset}
                  className="text-xs font-semibold text-[var(--color-brand)] hover:underline"
                >
                  Trocar arquivo
                </button>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2">
                <SummaryPill
                  label="Total"
                  value={rows.length}
                  tone="bg-[var(--color-surface-mid)] text-[var(--color-navy)]"
                />
                <SummaryPill
                  label="Válidos"
                  value={result.valid.length}
                  tone="bg-emerald-50 text-emerald-700"
                />
                <SummaryPill
                  label="Com erro"
                  value={result.errors.length}
                  tone={
                    result.errors.length
                      ? "bg-red-50 text-red-700"
                      : "bg-[var(--color-surface-mid)] text-[var(--color-on-surface-variant)]"
                  }
                />
              </div>

              {preview.length > 0 && (
                <div className="mb-4 overflow-hidden rounded-xl border border-[var(--color-outline-variant)]">
                  <p className="border-b border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                    Prévia (primeiras {preview.length} linhas)
                  </p>
                  <div className="custom-scrollbar overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white text-[var(--color-on-surface-variant)]">
                        <tr>
                          <th className="px-3 py-1.5">nome</th>
                          <th className="px-3 py-1.5">condomínio</th>
                          <th className="px-3 py-1.5">unidade</th>
                          <th className="px-3 py-1.5">status</th>
                          <th className="px-3 py-1.5">contato</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-outline-variant)]">
                        {preview.map((r, i) => (
                          <tr key={i} className="bg-white">
                            <td className="px-3 py-1.5">{r.nome}</td>
                            <td className="px-3 py-1.5">{r.condominio}</td>
                            <td className="px-3 py-1.5 text-[var(--color-on-surface-variant)]">
                              {r.tipo_endereco === "vertical"
                                ? `${r.bloco ?? ""} / ${r.apto ?? ""}`
                                : `${r.quadra ?? ""} / ${r.casa ?? ""}`}
                            </td>
                            <td className="px-3 py-1.5">{r.status}</td>
                            <td className="px-3 py-1.5">{r.contato}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50">
                  <p className="border-b border-red-200 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-red-700">
                    {result.errors.length} linha(s) com erro — serão ignoradas
                  </p>
                  <ul className="max-h-40 overflow-y-auto px-3 py-2 text-xs text-red-700">
                    {result.errors.slice(0, 20).map((e, i) => (
                      <li key={i}>
                        Linha {e.row}: {e.message}
                      </li>
                    ))}
                    {result.errors.length > 20 && (
                      <li className="mt-1 opacity-70">
                        …e mais {result.errors.length - 20}
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] px-5 py-3">
          <button
            onClick={onClose}
            className="h-9 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-xs font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
          >
            Cancelar
          </button>
          <button
            onClick={confirmImport}
            disabled={!result || result.valid.length === 0}
            className="btn-press btn-press-active inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-xs font-semibold text-white hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="check" className="text-[14px]" />
            Importar {result?.valid.length ? `${result.valid.length} morador(es)` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className={`rounded-lg px-3 py-2 ${tone}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-75">
        {label}
      </p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
