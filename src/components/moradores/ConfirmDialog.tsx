import { useEffect, useState } from "react";
import { Icon } from "@/components/brand/Icon";

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "warn" | "brand";
  icon?: string;
  /** Se preenchido, exige checkbox marcado com esse rótulo antes de confirmar. */
  requireCheckboxLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger",
  icon = "warning",
  requireCheckboxLabel,
  onConfirm,
  onClose,
}: Props) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!open) setChecked(false);
  }, [open]);

  if (!open) return null;

  const toneBtn =
    tone === "danger"
      ? "bg-red-600 hover:bg-red-700"
      : tone === "warn"
        ? "bg-amber-600 hover:bg-amber-700"
        : "bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)]";

  const toneIcon =
    tone === "danger"
      ? "bg-red-50 text-red-600"
      : tone === "warn"
        ? "bg-amber-50 text-amber-700"
        : "bg-[var(--color-brand)]/10 text-[var(--color-brand)]";

  const disabled = !!requireCheckboxLabel && !checked;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className={`grid h-11 w-11 place-items-center rounded-xl ${toneIcon}`}>
            <Icon name={icon} className="text-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-[var(--color-navy)]">{title}</h3>
            {description && (
              <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
                {description}
              </p>
            )}
          </div>
        </div>

        {requireCheckboxLabel && (
          <label className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] p-3 text-xs">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-[var(--color-navy)]">{requireCheckboxLabel}</span>
          </label>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              if (disabled) return;
              onConfirm();
            }}
            disabled={disabled}
            className={`inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${toneBtn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
