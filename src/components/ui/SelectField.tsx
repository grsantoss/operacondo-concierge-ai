import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/brand/Icon";

export function SelectField({
  value,
  onChange,
  options,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 py-2.5 text-left text-sm text-[var(--color-navy)] outline-none transition focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15"
      >
        <span className="truncate">{value}</span>
        <Icon
          name="expand_more"
          className={`text-[18px] text-[var(--color-on-surface-variant)] transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-lg border border-[var(--color-outline-variant)] bg-white p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          {options.map((opt) => {
            const selected = opt === value;
            return (
              <li key={opt}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                    selected
                      ? "bg-[var(--color-brand-soft)] font-semibold text-[var(--color-brand)]"
                      : "text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)]"
                  }`}
                >
                  <span className="truncate">{opt}</span>
                  {selected ? <Icon name="check" className="text-[16px]" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
