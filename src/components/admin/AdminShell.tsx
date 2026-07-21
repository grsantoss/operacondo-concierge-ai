import { Link, useRouterState, useNavigate, type LinkProps } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/brand/Icon";

interface NavItem {
  to: LinkProps["to"];
  label: string;
  icon: string;
}

const NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: "dashboard" },
  { to: "/admin/usuarios", label: "Usuários", icon: "group" },
  { to: "/admin/ambientes", label: "Ambientes", icon: "tune" },
  { to: "/admin/financeiro", label: "Financeiro", icon: "payments" },
  { to: "/admin/configuracoes", label: "Configurações", icon: "settings" },
];

interface Props {
  title: string;
  breadcrumbs?: { label: string; to?: LinkProps["to"] }[];
  actions?: ReactNode;
  children: ReactNode;
}

export function AdminShell({ title, breadcrumbs, actions, children }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (to: string) =>
    to === "/admin" ? pathname === "/admin" : pathname.startsWith(to);

  return (
    <div className="min-h-screen w-full bg-[var(--color-surface)] text-[var(--color-on-surface)]">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-[var(--color-navy-deep)] text-white transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-hover)]">
              <Icon name="admin_panel_settings" className="text-[22px] text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">OperaCondo</p>
              <p className="text-[10px] uppercase tracking-widest text-white/50">Admin Master</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
            Plataforma
          </p>
          {NAV.map((item) => {
            const active = isActive(item.to as string);
            return (
              <Link
                key={item.to as string}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-white/12 text-white shadow-[inset_3px_0_0_var(--color-brand-fixed)]"
                    : "text-white/70 hover:bg-white/8 hover:text-white"
                }`}
              >
                <Icon name={item.icon} filled={active} className="text-[20px] shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            onClick={() => navigate({ to: "/app" })}
            className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-white/8"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10">
              <Icon name="arrow_back" className="text-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">Voltar para o app</p>
              <p className="truncate text-[11px] text-white/50">Portal do síndico</p>
            </div>
          </button>
        </div>
      </aside>

      {mobileOpen ? (
        <div onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-black/40 lg:hidden" />
      ) : null}

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--color-outline-variant)] bg-white/85 px-4 backdrop-blur-md lg:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg hover:bg-[var(--color-surface-mid)] lg:hidden"
            aria-label="Abrir menu"
          >
            <Icon name="menu" />
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand)]/10 px-3 py-1 text-xs font-bold text-[var(--color-brand)]">
            <Icon name="shield_person" className="text-[14px]" />
            Admin Master
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Link
              to="/app"
              className="hidden md:inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)]"
            >
              <Icon name="apartment" className="text-[16px]" />
              Ver app do síndico
            </Link>
          </div>
        </header>

        <div className="border-b border-[var(--color-outline-variant)] bg-white px-4 py-6 lg:px-8 lg:py-7">
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <nav className="mb-2 flex items-center gap-1.5 text-xs text-[var(--color-on-surface-variant)]">
              {breadcrumbs.map((b, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {b.to ? (
                    <Link to={b.to} className="hover:text-[var(--color-brand)]">
                      {b.label}
                    </Link>
                  ) : (
                    <span>{b.label}</span>
                  )}
                  {i < breadcrumbs.length - 1 ? (
                    <Icon name="chevron_right" className="text-[14px] text-[var(--color-outline)]" />
                  ) : null}
                </span>
              ))}
            </nav>
          ) : null}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <h1 className="truncate text-2xl font-bold tracking-tight text-[var(--color-navy)] lg:text-3xl">
              {title}
            </h1>
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
          </div>
        </div>

        <main className="px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
