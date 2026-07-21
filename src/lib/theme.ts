export type ThemeMode = "claro" | "escuro" | "auto";

const STORAGE_KEY = "oc.theme";
const media = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "claro";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "claro" || v === "escuro" || v === "auto") return v;
  } catch {}
  return "claro";
}

function resolve(mode: ThemeMode): "light" | "dark" {
  if (mode === "auto") return media()?.matches ? "dark" : "light";
  return mode === "escuro" ? "dark" : "light";
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const effective = resolve(mode);
  root.classList.toggle("dark", effective === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {}
}

let autoListenerAttached = false;
export function initTheme() {
  if (typeof window === "undefined") return;
  const mode = getStoredTheme();
  applyTheme(mode);
  if (!autoListenerAttached) {
    const mq = media();
    mq?.addEventListener?.("change", () => {
      if (getStoredTheme() === "auto") applyTheme("auto");
    });
    autoListenerAttached = true;
  }
}
