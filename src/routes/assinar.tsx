import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { abrirCheckout, confirmarCheckout, listarPlanosPublicos } from "@/lib/cobranca.functions";
import { getSessao } from "@/lib/sessao.functions";
import { brl, escolhaDaUrl, mensagem, precoNoIntervalo, type Escolha } from "@/lib/planos";

export const Route = createFileRoute("/assinar")({
  head: () => ({ meta: [{ title: "Assinatura | OperaCondo Concierge" }] }),
  validateSearch: (s: Record<string, unknown>): Escolha & { sessao?: string } => ({
    ...escolhaDaUrl(s),
    sessao: typeof s.sessao === "string" ? s.sessao : undefined,
  }),
  beforeLoad: async ({ location, search }) => {
    const sessao = await getSessao();
    if (!sessao) throw redirect({ to: "/", search: { redirect: location.href } });
    if (!sessao.tenantId) throw redirect({ to: sessao.admin ? "/admin" : "/" });
    if (!sessao.assinaturaPendente) throw redirect({ to: search.sessao ? "/onboarding" : "/app" });
  },
  loaderDeps: ({ search }) => ({ sessao: search.sessao }),
  // Volta do Checkout: espelha a assinatura na hora e segue para o onboarding.
  loader: async ({ deps }) => {
    if (deps.sessao) {
      const r = await confirmarCheckout({ data: { sessao: deps.sessao } });
      if (r.concluido) throw redirect({ to: "/onboarding" });
    }
    return { planos: await listarPlanosPublicos(), naoConcluido: Boolean(deps.sessao) };
  },
  component: AssinarPage,
});

function AssinarPage() {
  const { planos, naoConcluido } = Route.useLoaderData();
  const busca = Route.useSearch();
  const [planoId, setPlanoId] = useState(
    planos.find((p) => p.id === busca.plano)?.id ?? planos[0]?.id ?? "",
  );
  const [intervalo, setIntervalo] = useState(busca.intervalo ?? "mensal");
  const [erro, setErro] = useState<string | null>(
    naoConcluido ? "O pagamento ainda não foi concluído." : null,
  );
  const [abrindo, setAbrindo] = useState(false);
  const plano = planos.find((p) => p.id === planoId);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-xl items-center justify-between px-4 py-5">
        <Logo variant="dark" to="/planos" />
        <button
          type="button"
          onClick={async () => {
            await authClient.signOut();
            window.location.href = "/";
          }}
          className="text-sm font-semibold text-primary hover:underline"
        >
          Sair
        </button>
      </header>
      <main className="mx-auto max-w-xl px-4 pb-16">
        <div className="space-y-5 rounded-2xl border border-border bg-card p-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Ative sua assinatura
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Informe o cartão no ambiente seguro do Stripe. Os 7 primeiros dias são grátis e você
              pode cancelar antes de qualquer cobrança.
            </p>
          </div>
          <Escolher
            label="Plano"
            value={planoId}
            onChange={setPlanoId}
            options={planos.map((p) => ({
              value: p.id,
              label: `${p.nome} · ${brl(precoNoIntervalo(p.precoMensal, intervalo))}${intervalo === "anual" ? "/ano" : "/mês"}`,
            }))}
          />
          <Escolher
            label="Cobrança"
            value={intervalo}
            onChange={(v) => setIntervalo(v === "anual" ? "anual" : "mensal")}
            options={[
              { value: "mensal", label: "Mensal" },
              { value: "anual", label: "Anual (paga 10 meses, leva 12)" },
            ]}
          />
          {erro ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {erro}
            </p>
          ) : null}
          <Button
            size="lg"
            className="w-full"
            disabled={!plano || abrindo}
            onClick={async () => {
              setErro(null);
              setAbrindo(true);
              try {
                const { url } = await abrirCheckout({ data: { planoId, intervalo } });
                window.location.href = url;
              } catch (err) {
                setAbrindo(false);
                setErro(mensagem(err));
              }
            }}
          >
            {abrindo ? "Abrindo o pagamento…" : "Ir para o pagamento"}
          </Button>
        </div>
      </main>
    </div>
  );
}

function Escolher({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = `escolha-${label}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
