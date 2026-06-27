import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@/components/brand/Icon";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar | Concierge OperaCondo" },
      {
        name: "description",
        content:
          "Acesse o Concierge OperaCondo — plataforma premium de gestão condominial com inteligência artificial.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [showPwd, setShowPwd] = useState(false);

  return (
    <main className="flex min-h-screen w-full overflow-hidden bg-[var(--color-surface)]">
      {/* Left — brand */}
      <section className="pattern-navy relative hidden w-1/2 flex-col justify-between p-12 lg:flex">
        <div className="relative z-10">
          <Logo variant="light" subtitle="Premium SaaS para síndicos profissionais" to="/" />
        </div>

        <div className="relative z-10 max-w-lg space-y-6">
          <h2 className="text-[44px] font-bold leading-[1.05] tracking-tight text-white">
            Gestão condominial com
            <span className="block bg-gradient-to-r from-[var(--color-brand-fixed)] to-white bg-clip-text text-transparent">
              inteligência artificial
            </span>
          </h2>
          <p className="max-w-md text-[15px] leading-relaxed text-white/75">
            Otimize processos, reduza custos e eleve a experiência dos moradores
            com a plataforma líder em inovação para síndicos profissionais.
          </p>

          <div className="grid grid-cols-3 gap-3 pt-4">
            {[
              { v: "98%", l: "Resolução IA" },
              { v: "12min", l: "Resposta média" },
              { v: "+340", l: "Condomínios" },
            ].map((s) => (
              <div
                key={s.l}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 backdrop-blur-sm"
              >
                <p className="text-2xl font-bold text-white">{s.v}</p>
                <p className="text-[11px] text-white/60">{s.l}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3 text-[11px] text-white/50">
          <span>© 2026 OperaCondo SaaS</span>
          <span className="h-1 w-1 rounded-full bg-white/40" />
          <span>v4.1.0-stable</span>
          <span className="h-1 w-1 rounded-full bg-white/40" />
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Todos os sistemas operacionais
          </span>
        </div>
      </section>

      {/* Right — form */}
      <section className="flex w-full flex-col items-center justify-center bg-white px-6 py-10 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden">
            <Logo variant="dark" to="/" />
          </div>

          <div className="space-y-2">
            <h3 className="text-3xl font-bold tracking-tight text-[var(--color-navy)]">
              Bem-vindo de volta
            </h3>
            <p className="text-sm text-[var(--color-on-surface-variant)]">
              Acesse sua conta para gerenciar seus condomínios.
            </p>
          </div>

          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/app" });
            }}
          >
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]"
              >
                E-mail
              </label>
              <input
                id="email"
                type="email"
                defaultValue="roberto@auroraadmin.com.br"
                placeholder="nome@empresa.com.br"
                className="w-full rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 py-3 text-sm outline-none transition-all focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]"
                >
                  Senha
                </label>
                <a
                  href="#"
                  className="text-xs font-semibold text-[var(--color-brand)] hover:underline"
                >
                  Esqueci minha senha
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  defaultValue="••••••••••"
                  className="w-full rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 py-3 pr-12 text-sm outline-none transition-all focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)] hover:text-[var(--color-navy)]"
                >
                  <Icon name={showPwd ? "visibility_off" : "visibility"} className="text-[20px]" />
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-[var(--color-on-surface-variant)]">
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-[var(--color-outline-variant)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
              />
              Manter-me conectado por 30 dias
            </label>

            <button
              type="submit"
              className="btn-press btn-press-active w-full rounded-lg bg-[var(--color-brand)] py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)] hover:shadow-md"
            >
              Entrar na plataforma
            </button>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-[var(--color-outline-variant)]" />
            <span className="mx-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-outline)]">
              ou continue com
            </span>
            <div className="flex-grow border-t border-[var(--color-outline-variant)]" />
          </div>

          <button
            type="button"
            className="btn-press btn-press-active flex w-full items-center justify-center gap-3 rounded-lg border border-[var(--color-outline-variant)] bg-white py-3 text-sm font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Entrar com o Google
          </button>

          <p className="pt-2 text-center text-sm text-[var(--color-on-surface-variant)]">
            Não tem conta?{" "}
            <Link
              to="/onboarding"
              className="inline-flex items-center gap-1 font-semibold text-[var(--color-brand)] hover:underline"
            >
              Solicite uma demo
              <Icon name="arrow_forward" className="text-[16px]" />
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
