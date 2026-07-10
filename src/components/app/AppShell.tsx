import { Link, useRouterState, type LinkProps } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { Icon } from "@/components/brand/Icon";

interface NavItem {
  to: LinkProps["to"];
  label: string;
  icon: string;
  badge?: string;
}

const NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: "dashboard" },
  { to: "/app/demandas", label: "Demandas", icon: "assignment", badge: "12" },
  { to: "/app/agente", label: "Agente IA", icon: "smart_toy", badge: "3" },
  { to: "/app/moradores", label: "Moradores", icon: "group" },
  { to: "/app/fornecedores", label: "Fornecedores", icon: "inventory_2" },
  { to: "/app/base", label: "Base de Conhecimento", icon: "menu_book" },
];

interface AppShellProps {
  title: string;
  breadcrumbs?: { label: string; to?: LinkProps["to"] }[];
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, breadcrumbs, actions, children }: AppShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (to: string) =>
    to === "/app" ? pathname === "/app" : pathname.startsWith(to);

  return (
    <div className="min-h-screen w-full bg-[var(--color-surface)] text-[var(--color-on-surface)]">
      {/* Sidebar — Deep Navy */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-[var(--color-navy-deep)] text-white transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-5 border-b border-white/10">
          <Logo variant="light" subtitle="OperaCondo SaaS • Admin" />
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 custom-scrollbar">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
            Operação
          </p>
          {NAV.map((item) => {
            const active = isActive(item.to as string);
            return (
              <Link
                key={item.to as string}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-white/12 text-white shadow-[inset_3px_0_0_var(--color-brand-fixed)]"
                    : "text-white/70 hover:bg-white/8 hover:text-white"
                }`}
              >
                <Icon
                  name={item.icon}
                  filled={active}
                  className="text-[20px] shrink-0"
                />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      active
                        ? "bg-white text-[var(--color-navy-deep)]"
                        : "bg-white/15 text-white"
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}

          <div className="pt-6">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Configuração
            </p>
            <Link
              to="/onboarding"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/8 hover:text-white"
            >
              <Icon name="rocket_launch" className="text-[20px] shrink-0" />
              <span className="flex-1 truncate">Onboarding</span>
              <span className="rounded-full bg-[var(--color-brand)] px-2 py-0.5 text-[10px] font-bold text-white">
                Novo
              </span>
            </Link>
            <Link
              to="/app/configuracoes"
              onClick={() => setMobileOpen(false)}
              activeProps={{ className: "bg-white/10 text-white" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/8 hover:text-white"
            >
              <Icon name="settings" className="text-[20px] shrink-0" />
              <span className="flex-1 truncate">Configurações</span>
            </Link>
          </div>
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/8">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-hover)] text-sm font-bold text-white">
              RS
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                Roberto Silva
              </p>
              <p className="truncate text-[11px] text-white/50">
                Síndico • Premium
              </p>
            </div>
            <Icon name="more_vert" className="text-[18px] text-white/50" />
          </div>
        </div>
      </aside>

      {mobileOpen ? (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      ) : null}

      {/* Main rail */}
      <div className="lg:pl-[260px]">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--color-outline-variant)] bg-white/85 px-4 backdrop-blur-md lg:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg hover:bg-[var(--color-surface-mid)] lg:hidden"
            aria-label="Abrir menu"
          >
            <Icon name="menu" />
          </button>
          <div className="relative hidden flex-1 max-w-md md:block">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[var(--color-on-surface-variant)]"
            />
            <input
              placeholder="Buscar moradores, unidades, demandas…"
              className="w-full rounded-lg border border-transparent bg-[var(--color-surface-mid)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)] outline-none focus:border-[var(--color-brand)] focus:bg-white focus:ring-2 focus:ring-[var(--color-brand)]/15"
            />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button className="grid h-10 w-10 place-items-center rounded-lg text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]">
              <Icon name="bolt" />
            </button>
            <button className="relative grid h-10 w-10 place-items-center rounded-lg text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]">
              <Icon name="notifications" />
              <span className="absolute right-2 top-2 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--color-danger)] px-1 text-[9px] font-bold text-white">
                4
              </span>
            </button>
            <div className="mx-2 h-6 w-px bg-[var(--color-outline-variant)]" />
            <div className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-[var(--color-surface-mid)]">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-navy)] text-xs font-bold text-white">
                RS
              </div>
              <div className="hidden text-left md:block">
                <p className="text-xs font-semibold leading-tight text-[var(--color-on-surface)]">
                  Roberto Silva
                </p>
                <p className="text-[10px] leading-tight text-[var(--color-on-surface-variant)]">
                  Edifício Aurora
                </p>
              </div>
              <Icon
                name="expand_more"
                className="hidden text-[18px] text-[var(--color-on-surface-variant)] md:inline-block"
              />
            </div>
          </div>
        </header>

        {/* Page header */}
        <div className="border-b border-[var(--color-outline-variant)] bg-white px-4 py-6 lg:px-8 lg:py-7">
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <nav className="mb-2 flex items-center gap-1.5 text-xs text-[var(--color-on-surface-variant)]">
              {breadcrumbs.map((b, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {b.to ? (
                    <Link
                      to={b.to}
                      className="hover:text-[var(--color-brand)]"
                    >
                      {b.label}
                    </Link>
                  ) : (
                    <span>{b.label}</span>
                  )}
                  {i < breadcrumbs.length - 1 ? (
                    <Icon
                      name="chevron_right"
                      className="text-[14px] text-[var(--color-outline)]"
                    />
                  ) : null}
                </span>
              ))}
            </nav>
          ) : null}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight text-[var(--color-navy)] lg:text-3xl">
                {title}
              </h1>
            </div>
            {actions ? (
              <div className="flex shrink-0 items-center gap-2">{actions}</div>
            ) : null}
          </div>
        </div>

        <main className="px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
