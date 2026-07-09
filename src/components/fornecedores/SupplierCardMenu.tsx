import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/brand/Icon";

interface MenuAction {
  label: string;
  icon: string;
  onClick: () => void;
  tone?: "default" | "danger";
  divider?: boolean;
}

export function SupplierCardMenu({ actions }: { actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Mais ações"
        className="btn-press btn-press-active grid h-10 w-10 place-items-center rounded-lg border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-low)]"
      >
        <Icon name="more_horiz" className="text-[18px]" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-[var(--color-outline-variant)] bg-white py-1 shadow-lg">
          {actions.map((a, i) => (
            <div key={i}>
              {a.divider && <div className="my-1 h-px bg-[var(--color-outline-variant)]" />}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  a.onClick();
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold hover:bg-[var(--color-surface-low)] ${
                  a.tone === "danger"
                    ? "text-red-600"
                    : "text-[var(--color-navy)]"
                }`}
              >
                <Icon name={a.icon} className="text-[16px]" /> {a.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
