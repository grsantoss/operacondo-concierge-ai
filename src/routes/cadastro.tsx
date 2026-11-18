import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { abrirCheckout, criarConta, listarPlanosPublicos } from "@/lib/cobranca.functions";
import { getSessao } from "@/lib/sessao.functions";
import { brl, escolhaDaUrl, mensagem, precoNoIntervalo } from "@/lib/planos";

export const Route = createFileRoute("/cadastro")({
  head: () => ({ meta: [{ title: "Criar conta | OperaCondo Concierge" }] }),
  validateSearch: escolhaDaUrl,
  beforeLoad: async () => {
    const sessao = await getSessao();
    if (sessao?.tenantId) throw redirect({ to: "/app" });
  },
  loader: () => listarPlanosPublicos(),
  component: CadastroPage,
});

const CAMPOS = {
  voce: [
    { name: "nome", label: "Seu nome", autoComplete: "name" },
    { name: "email", label: "E-mail", type: "email", autoComplete: "email" },
    {
      name: "senha",
      label: "Senha (mínimo 8 caracteres)",
      type: "password",
      autoComplete: "new-password",
      minLength: 8,
    },
  ],
  empresa: [
    { name: "razaoSocial", label: "Razão social", autoComplete: "organization" },
    { name: "nomeFantasia", label: "Nome fantasia" },
    {
      name: "cnpj",
      label: "CNPJ",
      inputMode: "numeric" as const,
      placeholder: "00.000.000/0000-00",
    },
    { name: "telefone", label: "Telefone com DDD", type: "tel", autoComplete: "tel" },
  ],
};

function CadastroPage() {
  const { plano: planoId, intervalo = "mensal" } = Route.useSearch();
  const planos = Route.useLoaderData();
  const plano = planos.find((p) => p.id === planoId) ?? planos[0];
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<string | null>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setErro(null);
    try {
      setEtapa("Criando sua conta…");
      await criarConta({
        data: {
          nome: f.nome!,
          email: f.email!,
          senha: f.senha!,
          razaoSocial: f.razaoSocial!,
          nomeFantasia: f.nomeFantasia!,
          cnpj: f.cnpj!,
          telefone: f.telefone!,
        },
      });
    } catch (err) {
      setEtapa(null);
      return setErro(mensagem(err));
    }
    const { error } = await authClient.signIn.email({ email: f.email!, password: f.senha! });
    if (error) {
      setEtapa(null);
      return setErro("Conta criada, mas não foi possível entrar. Entre pela tela de login.");
    }
    try {
      setEtapa("Abrindo o pagamento…");
      const { url } = await abrirCheckout({ data: { planoId: plano!.id, intervalo } });
      window.location.href = url;
    } catch {
      // Conta já existe: /assinar mostra o erro e deixa tentar de novo.
      navigate({ to: "/assinar", search: { plano: plano!.id, intervalo } });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5">
        <Logo variant="dark" to="/planos" />
        <Link to="/" className="text-sm font-semibold text-primary hover:underline">
          Já tenho conta
        </Link>
      </header>
      <main className="mx-auto grid max-w-4xl gap-6 px-4 pb-16 md:grid-cols-[minmax(0,1fr)_280px]">
        <form
          method="post"
          onSubmit={enviar}
          className="space-y-6 rounded-2xl border border-border bg-card p-6"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Crie sua conta</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Depois você informa o cartão no Stripe. Nada é cobrado nos 7 primeiros dias.
            </p>
          </div>
          <Grupo titulo="Seus dados" campos={CAMPOS.voce} />
          <Grupo titulo="Empresa ou síndico profissional" campos={CAMPOS.empresa} />
          <p className="text-xs text-muted-foreground">
            Um teste grátis por CNPJ, por número de WhatsApp e por cartão.
          </p>
          {erro ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {erro}
            </p>
          ) : null}
          <Button type="submit" size="lg" className="w-full" disabled={Boolean(etapa)}>
            {etapa ?? "Continuar para o pagamento"}
          </Button>
        </form>

        {plano ? (
          <aside className="h-fit rounded-2xl border border-border bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Plano escolhido
            </p>
            <p className="mt-2 text-lg font-bold text-foreground">{plano.nome}</p>
            <p className="text-sm text-foreground">
              {brl(precoNoIntervalo(plano.precoMensal, intervalo))}
              {intervalo === "anual" ? "/ano" : "/mês"} após 7 dias grátis
            </p>
            <Link
              to="/planos"
              className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
            >
              Trocar de plano
            </Link>
          </aside>
        ) : null}
      </main>
    </div>
  );
}

function Grupo({
  titulo,
  campos,
}: {
  titulo: string;
  campos: (React.InputHTMLAttributes<HTMLInputElement> & { name: string; label: string })[];
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-foreground">{titulo}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {campos.map(({ label, ...c }) => (
          <div key={c.name} className="space-y-1.5">
            <Label htmlFor={c.name}>{label}</Label>
            <Input id={c.name} required {...c} />
          </div>
        ))}
      </div>
    </fieldset>
  );
}
