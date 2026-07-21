import { Link, useRouterState, useNavigate, type LinkProps } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
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

interface UserMenuItem {
  icon: string;
  label: string;
  to?: LinkProps["to"];
  onClick?: () => void;
  danger?: boolean;
  divider?: boolean;
}

function useOutsideClose(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [open, onClose]);
  return ref;
}

function UserMenu({
  open,
  onClose,
  align,
  items,
}: {
  open: boolean;
  onClose: () => void;
  align: "left" | "right";
  items: UserMenuItem[];
}) {
  const ref = useOutsideClose(open, onClose);
  if (!open) return null;
  return (
    <div
      ref={ref}
      className={`absolute z-50 w-64 overflow-hidden rounded-xl border border-[var(--color-outline-variant)] bg-white shadow-xl ${
        align === "right" ? "right-0" : "left-0"
      }`}
    >
      <div className="border-b border-[var(--color-outline-variant)] bg-[var(--color-surface-mid)] px-4 py-3">
        <p className="text-sm font-semibold text-[var(--color-navy)]">Roberto Silva</p>
        <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
          roberto@operacondo.com.br
        </p>
      </div>
      <ul className="py-1">
        {items.map((item, i) => {
          if (item.divider) {
            return <li key={`d-${i}`} className="my-1 h-px bg-[var(--color-outline-variant)]" />;
          }
          const cls = `flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
            item.danger
              ? "text-[var(--color-danger)] hover:bg-red-50"
              : "text-[var(--color-on-surface)] hover:bg-[var(--color-surface-mid)]"
          }`;
          const inner = (
            <>
              <Icon name={item.icon} className="text-[18px] shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
            </>
          );
          if (item.to) {
            return (
              <li key={item.label}>
                <Link to={item.to} onClick={onClose} className={cls}>
                  {inner}
                </Link>
              </li>
            );
          }
          return (
            <li key={item.label}>
              <button
                onClick={() => {
                  onClose();
                  item.onClick?.();
                }}
                className={cls}
              >
                {inner}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const COLLAPSE_KEY = "oc.sidebar.collapsed";

export function AppShell({ title, breadcrumbs, actions, children }: AppShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [topMenu, setTopMenu] = useState(false);
  const [sideMenu, setSideMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);

  const toggleCollapse = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {}
      if (next) setSideMenu(false);
      return next;
    });
  };

  const isActive = (to: string) =>
    to === "/app" ? pathname === "/app" : pathname.startsWith(to);

  const handleLogout = () => {
    if (confirm("Deseja realmente sair da aplicação?")) {
      navigate({ to: "/" });
    }
  };

  const menuItems: UserMenuItem[] = [
    { icon: "person", label: "Meu perfil", to: "/app/configuracoes" },
    { icon: "settings", label: "Configurações", to: "/app/configuracoes" },
    { icon: "apartment", label: "Meu condomínio", to: "/app/configuracoes" },
    { icon: "notifications", label: "Notificações", to: "/app/configuracoes" },
    { divider: true, icon: "", label: "" },
    { icon: "rocket_launch", label: "Onboarding", to: "/onboarding" },
    { icon: "help", label: "Central de ajuda", onClick: () => window.open("https://docs.lovable.dev", "_blank") },
    { divider: true, icon: "", label: "" },
    { icon: "logout", label: "Sair da aplicação", onClick: handleLogout, danger: true },
  ];

  const sidebarWidth = collapsed ? 76 : 260;

  return (
    <div className="min-h-screen w-full bg-[var(--color-surface)] text-[var(--color-on-surface)]">
      {/* Sidebar — Deep Navy */}
      <aside
        style={{ width: sidebarWidth }}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[var(--color-navy-deep)] text-white transition-[width,transform] duration-300 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className={`flex items-center border-b border-white/10 ${collapsed ? "justify-center px-2 py-4" : "justify-between px-5 py-5"}`}>
          {collapsed ? (
            <Link to="/app" className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white transition-transform hover:scale-105" title="Concierge OperaCondo">
              <Icon name="apartment" className="text-[22px]" />
            </Link>
          ) : (
            <Logo variant="light" subtitle="OperaCondo SaaS • Admin" />
          )}
        </div>
        <nav className={`flex-1 overflow-y-auto py-4 space-y-0.5 custom-scrollbar ${collapsed ? "px-2" : "px-3"}`}>
          {!collapsed ? (
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Operação
            </p>
          ) : null}
          {NAV.map((item) => {
            const active = isActive(item.to as string);
            return (
              <Link
                key={item.to as string}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`group flex items-center rounded-lg text-sm font-medium transition-all ${
                  collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
                } ${
                  active
                    ? "bg-white/12 text-white shadow-[inset_3px_0_0_var(--color-brand-fixed)]"
                    : "text-white/70 hover:bg-white/8 hover:text-white"
                }`}
              >
                <div className="relative">
                  <Icon
                    name={item.icon}
                    filled={active}
                    className="text-[20px] shrink-0"
                  />
                  {collapsed && item.badge ? (
                    <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--color-brand)] px-1 text-[9px] font-bold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                {!collapsed ? (
                  <>
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
                  </>
                ) : null}
              </Link>
            );
          })}

          <div className="pt-6">
            {!collapsed ? (
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                Configuração
              </p>
            ) : null}
            <Link
              to="/onboarding"
              onClick={() => setMobileOpen(false)}
              title={collapsed ? "Onboarding" : undefined}
              className={`flex items-center rounded-lg text-sm font-medium text-white/70 hover:bg-white/8 hover:text-white ${
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
              }`}
            >
              <Icon name="rocket_launch" className="text-[20px] shrink-0" />
              {!collapsed ? (
                <>
                  <span className="flex-1 truncate">Onboarding</span>
                  <span className="rounded-full bg-[var(--color-brand)] px-2 py-0.5 text-[10px] font-bold text-white">
                    Novo
                  </span>
                </>
              ) : null}
            </Link>
            <Link
              to="/app/configuracoes"
              onClick={() => setMobileOpen(false)}
              title={collapsed ? "Configurações" : undefined}
              activeProps={{ className: "bg-white/10 text-white" }}
              className={`flex items-center rounded-lg text-sm font-medium text-white/70 hover:bg-white/8 hover:text-white ${
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
              }`}
            >
              <Icon name="settings" className="text-[20px] shrink-0" />
              {!collapsed ? <span className="flex-1 truncate">Configurações</span> : null}
            </Link>
          </div>
        </nav>

        {/* Collapse toggle (desktop) */}
        <button
          onClick={toggleCollapse}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          className="mx-3 mb-2 hidden lg:flex items-center justify-center gap-2 rounded-lg border border-white/10 py-2 text-xs font-semibold text-white/70 hover:bg-white/8 hover:text-white"
        >
          <Icon name={collapsed ? "chevron_right" : "chevron_left"} className="text-[18px]" />
          {!collapsed ? <span>Recolher</span> : null}
        </button>

        <div className="relative border-t border-white/10 p-3">
          <button
            onClick={() => {
              if (collapsed) {
                toggleCollapse();
                return;
              }
              setSideMenu((v) => !v);
            }}
            title={collapsed ? "Expandir menu" : undefined}
            className={`flex w-full items-center rounded-lg text-left hover:bg-white/8 ${
              collapsed ? "justify-center p-1.5" : "gap-3 p-2"
            }`}
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-hover)] text-sm font-bold text-white">
              RS
            </div>
            {!collapsed ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    Roberto Silva
                  </p>
                  <p className="truncate text-[11px] text-white/50">
                    Síndico • Premium
                  </p>
                </div>
                <Icon name={sideMenu ? "expand_less" : "more_vert"} className="text-[18px] text-white/50" />
              </>
            ) : null}
          </button>
          {sideMenu && !collapsed ? (
            <div className="absolute bottom-[76px] left-3 right-3">
              <UserMenu open={sideMenu} onClose={() => setSideMenu(false)} align="left" items={menuItems} />
            </div>
          ) : null}
        </div>
      </aside>

      {mobileOpen ? (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      ) : null}

      {/* Main rail */}
      <div
        className="transition-[padding] duration-300"
        style={{ paddingLeft: 0 }}
      >
        <div style={{ paddingLeft: 0 }} className="lg:[padding-left:var(--sb-w)]">
          {/* CSS var wrapper below */}
        </div>
        <style>{`@media (min-width: 1024px){ .oc-main{ padding-left: ${sidebarWidth}px; } }`}</style>
        <div className="oc-main">
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--color-outline-variant)] bg-white/85 px-4 backdrop-blur-md lg:px-8">
            <button
              onClick={() => setMobileOpen(true)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg hover:bg-[var(--color-surface-mid)] lg:hidden"
              aria-label="Abrir menu"
            >
              <Icon name="menu" />
            </button>
            <button
              onClick={toggleCollapse}
              className="hidden lg:grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              title={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              <Icon name={collapsed ? "menu_open" : "menu"} />
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
              <div className="relative">
                <button
                  onClick={() => setTopMenu((v) => !v)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-[var(--color-surface-mid)]"
                  aria-haspopup="menu"
                  aria-expanded={topMenu}
                >
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
                </button>
                <UserMenu open={topMenu} onClose={() => setTopMenu(false)} align="right" items={menuItems} />
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
    </div>
  );
}
