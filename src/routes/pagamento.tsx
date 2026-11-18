import { createFileRoute, redirect } from "@tanstack/react-router";
import { PlanoCobranca } from "@/components/app/PlanoCobranca";
import { Logo } from "@/components/brand/Logo";
import { meuPlanoQuery } from "@/data/cobranca";
import { authClient } from "@/lib/auth-client";
import { getSessao } from "@/lib/sessao.functions";

/** Conta congelada por inadimplência (D+10): a única tela que abre. Pagar reativa na hora. */
export const Route = createFileRoute("/pagamento")({
  head: () => ({ meta: [{ title: "Pagamento pendente | OperaCondo Concierge" }] }),
  beforeLoad: async ({ location }) => {
    const sessao = await getSessao();
    if (!sessao) throw redirect({ to: "/", search: { redirect: location.href } });
    if (!sessao.tenantId) throw redirect({ to: sessao.admin ? "/admin" : "/" });
    if (sessao.cobranca?.suspensao !== "integral") throw redirect({ to: "/app" });
    return { sessao };
  },
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(meuPlanoQuery),
  component: PagamentoPage,
});

const br = (d: string | null | undefined) => (d ? d.split("-").reverse().join("/") : "—");

function PagamentoPage() {
  const { sessao } = Route.useRouteContext();
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <Logo variant="dark" />
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
      <main className="mx-auto max-w-3xl space-y-4 px-4 pb-16">
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5"
        >
          <h1 className="text-xl font-bold text-destructive">
            Conta congelada por falta de pagamento
          </h1>
          <p className="mt-1 text-sm text-foreground">
            A fatura vencida em {br(sessao.cobranca?.inadimplenteDesde)} ainda não foi paga. O
            painel está bloqueado e o WhatsApp responde "atendimento indisponível". Sem pagamento,
            os dados serão excluídos em {br(sessao.cobranca?.exclusaoPrevistaEm)}. Pague a fatura
            abaixo para reativar na hora.
          </p>
        </div>
        <PlanoCobranca />
      </main>
    </div>
  );
}
