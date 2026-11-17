import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";
import {
  COLECOES,
  VISIBILIDADES,
  useDocumentosAcoes,
  type ColecaoId,
  type VisibilidadeId,
} from "@/data/base";
import { condominiosQuery, useCondominios } from "@/data/moradores";

export const Route = createFileRoute("/app/base/enviar")({
  head: () => ({ meta: [{ title: "Enviar documento | Base de Conhecimento" }] }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(condominiosQuery),
  component: EnviarDocumentoPage,
});

// `.doc` antigo não é suportado pela leitura (Docling).
const ACCEPT = ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg";
const ACCEPT_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
];
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

const metaSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(3, "Informe um título com pelo menos 3 caracteres")
    .max(120, "Máximo de 120 caracteres"),
  condominioId: z.string().min(1, "Selecione o condomínio"),
  colecao: z.enum(COLECOES.map((c) => c.id) as [ColecaoId, ...ColecaoId[]], {
    error: "Selecione uma coleção",
  }),
  visibilidade: z.enum(VISIBILIDADES.map((v) => v.id) as [VisibilidadeId, ...VisibilidadeId[]]),
  vigencia: z.string().optional(),
});

type FileItem = {
  id: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
};

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function iconForFile(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "picture_as_pdf";
  if (ext === "doc" || ext === "docx") return "description";
  if (ext === "png" || ext === "jpg" || ext === "jpeg") return "image";
  if (ext === "txt" || ext === "md") return "article";
  return "insert_drive_file";
}

function EnviarDocumentoPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const condominios = useCondominios();
  const { enviar } = useDocumentosAcoes();
  const [meta, setMeta] = useState({
    titulo: "",
    condominioId: condominios.length === 1 ? condominios[0].id : "",
    colecao: "",
    visibilidade: "moradores",
    vigencia: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const totalSize = useMemo(
    () => files.reduce((s, f) => s + f.file.size, 0),
    [files],
  );

  function addFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    const next: FileItem[] = [];
    for (const f of arr) {
      if (f.size > MAX_BYTES) {
        next.push({
          id: crypto.randomUUID(),
          file: f,
          progress: 0,
          status: "error",
          error: "Arquivo maior que 20 MB",
        });
        continue;
      }
      if (/\.doc$/i.test(f.name)) {
        next.push({
          id: crypto.randomUUID(),
          file: f,
          progress: 0,
          status: "error",
          error: "Word antigo (.doc): salve como .docx ou PDF",
        });
        continue;
      }
      if (
        f.type &&
        !ACCEPT_MIME.includes(f.type) &&
        !ACCEPT.split(",").some((ext) =>
          f.name.toLowerCase().endsWith(ext.trim()),
        )
      ) {
        next.push({
          id: crypto.randomUUID(),
          file: f,
          progress: 0,
          status: "error",
          error: "Formato não suportado",
        });
        continue;
      }
      next.push({
        id: crypto.randomUUID(),
        file: f,
        progress: 0,
        status: "queued",
      });
    }
    setFiles((prev) => [...prev, ...next]);
    if (!meta.titulo && next[0]) {
      setMeta((m) => ({ ...m, titulo: next[0].file.name.replace(/\.[^.]+$/, "") }));
    }
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = metaSchema.safeParse(meta);
    const nextErrors: Record<string, string> = {};
    if (!parsed.success) {
      for (const iss of parsed.error.issues) {
        const k = iss.path[0] as string;
        if (!nextErrors[k]) nextErrors[k] = iss.message;
      }
    }
    const validFiles = files.filter((f) => f.status !== "error");
    if (validFiles.length === 0) nextErrors.files = "Selecione ao menos um arquivo válido";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (!parsed.success) return;
    const enviando = (status: FileItem["status"], error?: string) =>
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "error" ? f : { ...f, status, progress: status === "done" ? 100 : 50, error },
        ),
      );
    enviando("uploading");
    try {
      await enviar(
        {
          condominioId: parsed.data.condominioId,
          titulo: parsed.data.titulo,
          colecao: parsed.data.colecao,
          visibilidade: parsed.data.visibilidade,
          vigenteDesde: parsed.data.vigencia || undefined,
        },
        validFiles.map((f) => f.file),
      );
    } catch (err) {
      enviando("queued");
      setErrors({ files: (err as Error).message });
      return;
    }
    enviando("done");
    setSubmitted(true);
    setTimeout(() => navigate({ to: "/app/base" }), 1100);
  }

  return (
    <AppShell
      title="Enviar documento"
      breadcrumbs={[
        { label: "OperaCondo" },
        { label: "Base de Conhecimento", to: "/app/base" },
        { label: "Enviar" },
      ]}
      actions={
        <>
          <Link
            to="/app/base"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
          >
            <Icon name="arrow_back" className="text-[18px]" /> Voltar
          </Link>
          <button
            form="form-enviar-doc"
            type="submit"
            className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow-soft hover:bg-[var(--color-brand-hover)]"
          >
            <Icon name="cloud_upload" className="text-[18px]" /> Enviar para a base
          </button>
        </>
      }
    >
      {submitted ? (
        <div className="card-elev mx-auto max-w-lg rounded-2xl p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/10 text-success-strong">
            <Icon name="check_circle" className="text-[32px]" filled />
          </div>
          <h2 className="mt-4 text-lg font-bold text-[var(--color-navy)]">
            Documento{files.length > 1 ? "s enviados" : " enviado"}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
            Guardado na base. A leitura do conteúdo pela IA chega na próxima fase.
          </p>
        </div>
      ) : (
        <form
          id="form-enviar-doc"
          onSubmit={onSubmit}
          noValidate
          className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"
        >
          <div className="space-y-5">
            {/* DROPZONE */}
            <section className="card-elev rounded-2xl p-5 lg:p-6">
              <header className="mb-4 flex items-start gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                  <Icon name="upload_file" className="text-[18px]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-navy)]">
                    Arquivos
                  </h3>
                  <p className="text-xs text-[var(--color-on-surface-variant)]">
                    PDF, DOC, DOCX, TXT, MD, PNG ou JPG • até 20 MB cada
                  </p>
                </div>
              </header>

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
                  dragging
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5"
                    : "border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] hover:border-[var(--color-brand)]"
                }`}
              >
                <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-[var(--color-brand)] shadow-soft">
                  <Icon name="cloud_upload" className="text-[26px]" />
                </div>
                <p className="text-sm font-semibold text-[var(--color-navy)]">
                  Arraste arquivos aqui ou clique para selecionar
                </p>
                <p className="text-xs text-[var(--color-on-surface-variant)]">
                  Você pode enviar vários arquivos de uma vez
                </p>
              </button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />

              {errors.files ? (
                <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-destructive">
                  <Icon name="error" className="text-[13px]" /> {errors.files}
                </p>
              ) : null}

              {files.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {files.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center gap-3 rounded-lg border border-[var(--color-outline-variant)] bg-white p-3"
                    >
                      <div
                        className={`grid h-10 w-10 place-items-center rounded-lg ${
                          f.status === "error"
                            ? "bg-destructive/10 text-destructive"
                            : f.status === "done"
                              ? "bg-success/10 text-success-strong"
                              : "bg-[var(--color-surface-mid)] text-[var(--color-navy)]"
                        }`}
                      >
                        <Icon name={iconForFile(f.file.name)} className="text-[20px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--color-on-surface)]">
                          {f.file.name}
                        </p>
                        <p className="text-[11px] text-[var(--color-on-surface-variant)]">
                          {formatBytes(f.file.size)}
                          {f.error ? ` • ${f.error}` : ""}
                        </p>
                        {f.status === "uploading" ? (
                          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--color-surface-mid)]">
                            <div
                              className="h-full bg-[var(--color-brand)] transition-all"
                              style={{ width: `${f.progress}%` }}
                            />
                          </div>
                        ) : null}
                      </div>
                      {f.status === "done" ? (
                        <Icon
                          name="check_circle"
                          className="text-[20px] text-success-strong"
                          filled
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => removeFile(f.id)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
                          aria-label="Remover arquivo"
                        >
                          <Icon name="close" className="text-[18px]" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            {/* METADADOS */}
            <section className="card-elev rounded-2xl p-5 lg:p-6">
              <header className="mb-4 flex items-start gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                  <Icon name="topic" className="text-[18px]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-navy)]">
                    Classificação
                  </h3>
                  <p className="text-xs text-[var(--color-on-surface-variant)]">
                    Ajuda a IA a responder com precisão e cita a fonte correta
                  </p>
                </div>
              </header>

              <div className="space-y-4">
                <Field label="Título do documento" error={errors.titulo}>
                  <input
                    value={meta.titulo}
                    onChange={(e) =>
                      setMeta({ ...meta, titulo: e.target.value.slice(0, 120) })
                    }
                    maxLength={120}
                    placeholder="Ex.: Ata da AGO de 28/09/2025"
                    className={inputClass(errors.titulo)}
                  />
                </Field>

                <Field label="Condomínio" error={errors.condominioId}>
                  <select
                    value={meta.condominioId}
                    onChange={(e) => {
                      setMeta({ ...meta, condominioId: e.target.value });
                      if (errors.condominioId) setErrors((er) => ({ ...er, condominioId: "" }));
                    }}
                    className={inputClass(errors.condominioId)}
                  >
                    <option value="">Selecione…</option>
                    {condominios.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Coleção" error={errors.colecao}>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {COLECOES.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => {
                          setMeta({ ...meta, colecao: c.id });
                          if (errors.colecao)
                            setErrors((e) => ({ ...e, colecao: "" }));
                        }}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                          meta.colecao === c.id
                            ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                            : "border-[var(--color-outline-variant)] bg-white text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
                        }`}
                      >
                        <Icon name={c.icon} className="text-[16px]" />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Visibilidade" error={errors.visibilidade}>
                    <div className="space-y-1.5">
                      {VISIBILIDADES.map((v) => (
                        <label
                          key={v.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                            meta.visibilidade === v.id
                              ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5"
                              : "border-[var(--color-outline-variant)] hover:bg-[var(--color-surface-mid)]"
                          }`}
                        >
                          <input
                            type="radio"
                            name="visibilidade"
                            checked={meta.visibilidade === v.id}
                            onChange={() => setMeta({ ...meta, visibilidade: v.id })}
                            className="accent-[var(--color-brand)]"
                          />
                          <Icon
                            name={v.icon}
                            className="text-[16px] text-[var(--color-navy)]"
                          />
                          <span className="font-semibold text-[var(--color-on-surface)]">
                            {v.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </Field>

                  <Field label="Vigência (opcional)">
                    <input
                      type="date"
                      value={meta.vigencia}
                      onChange={(e) =>
                        setMeta({ ...meta, vigencia: e.target.value })
                      }
                      className={inputClass()}
                    />
                  </Field>
                </div>

              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="card-elev rounded-2xl p-5">
              <h3 className="text-sm font-bold text-[var(--color-navy)]">
                Resumo do envio
              </h3>
              <dl className="mt-3 space-y-2 text-xs">
                <SummaryRow
                  icon="description"
                  label="Arquivos"
                  value={`${files.length}`}
                />
                <SummaryRow
                  icon="database"
                  label="Tamanho total"
                  value={formatBytes(totalSize)}
                />
                <SummaryRow
                  icon="topic"
                  label="Coleção"
                  value={
                    COLECOES.find((c) => c.id === meta.colecao)?.label || "—"
                  }
                />
                <SummaryRow
                  icon="visibility"
                  label="Visibilidade"
                  value={
                    VISIBILIDADES.find((v) => v.id === meta.visibilidade)
                      ?.label || "—"
                  }
                />
                <SummaryRow
                  icon="apartment"
                  label="Condomínio"
                  value={condominios.find((c) => c.id === meta.condominioId)?.nome || "—"}
                />
              </dl>
            </section>

            <section className="card-elev rounded-2xl p-5">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-700">
                  <Icon name="tips_and_updates" className="text-[18px]" />
                </div>
                <h3 className="text-sm font-bold text-[var(--color-navy)]">
                  Boas práticas
                </h3>
              </div>
              <ul className="mt-3 space-y-2 text-xs text-[var(--color-on-surface-variant)]">
                <li className="flex gap-2">
                  <Icon
                    name="check"
                    className="mt-0.5 text-[14px] text-success-strong"
                  />
                  Prefira PDFs pesquisáveis — a IA extrai texto com mais precisão.
                </li>
                <li className="flex gap-2">
                  <Icon
                    name="check"
                    className="mt-0.5 text-[14px] text-success-strong"
                  />
                  Nomeie o arquivo com data e assunto para facilitar buscas.
                </li>
                <li className="flex gap-2">
                  <Icon
                    name="check"
                    className="mt-0.5 text-[14px] text-success-strong"
                  />
                  Documentos confidenciais? Mantenha visibilidade "Interno".
                </li>
              </ul>
            </section>
          </aside>
        </form>
      )}
    </AppShell>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--color-on-surface)]">
          {label}
        </span>
        {hint ? (
          <span className="text-[10px] text-[var(--color-on-surface-variant)]">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-destructive">
          <Icon name="error" className="text-[13px]" /> {error}
        </p>
      ) : null}
    </label>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex items-center gap-1.5 text-[var(--color-on-surface-variant)]">
        <Icon name={icon} className="text-[14px]" />
        {label}
      </dt>
      <dd className="truncate text-right font-semibold text-[var(--color-navy)]">
        {value}
      </dd>
    </div>
  );
}

function inputClass(err?: string) {
  return `w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-[var(--color-on-surface)] outline-none transition placeholder:text-[var(--color-on-surface-variant)] focus:ring-2 focus:ring-[var(--color-brand)]/30 ${
    err
      ? "border-destructive/50 focus:border-destructive"
      : "border-[var(--color-outline-variant)] focus:border-[var(--color-brand)]"
  }`;
}
