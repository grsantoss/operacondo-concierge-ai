import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { listarPlanosPublicos, type PlanoPublico } from "@/lib/cobranca.functions";
import { brl, num, precoNoIntervalo } from "@/lib/planos";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos | OperaCondo Concierge" },
      {
        name: "description",
        content:
          "Atendimento com IA para síndicos no WhatsApp: planos Essencial e Profissional, 7 dias grátis.",
      },
    ],
  }),
  loader: () => listarPlanosPublicos(),
  component: PlanosPage,
});

function PlanosPage() {
  const planos = Route.useLoaderData();
  const [intervalo, setIntervalo] = useState<"mensal" | "anual">("mensal");

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Logo variant="dark" to="/planos" />
        <Link to="/" className="text-sm font-semibold text-primary hover:underline">
          Entrar
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16">
        <section className="py-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            O concierge do seu condomínio no WhatsApp
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
            A IA responde os moradores com base na convenção, no regimento e nas atas, abre demandas
            e chama você quando precisa. Teste por {7} dias sem pagar.
          </p>

          <div
            role="radiogroup"
            aria-label="Forma de cobrança"
            className="mt-6 inline-flex rounded-lg border border-border bg-card p-1"
          >
            {(["mensal", "anual"] as const).map((i) => (
              <button
                key={i}
                role="radio"
                aria-checked={intervalo === i}
                onClick={() => setIntervalo(i)}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                  intervalo === i
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {i === "mensal" ? "Mensal" : "Anual · 2 meses grátis"}
              </button>
            ))}
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          {planos.map((p, i) => (
            <CartaoPlano key={p.id} plano={p} intervalo={intervalo} destaque={i === 1} />
          ))}
        </div>

        <div className="mt-8 space-y-2 text-center text-xs text-muted-foreground">
          <p>
            Cartão exigido para começar o teste. Cancele antes do fim dos 7 dias e nada é cobrado.
          </p>
          <p>
            O número de WhatsApp (Z-API ou API oficial da Meta) é contratado por você. Prefere o
            nosso? WhatsApp gerenciado por {brl(119)}/mês por número.
          </p>
        </div>
      </main>
    </div>
  );
}

function CartaoPlano({
  plano: p,
  intervalo,
  destaque,
}: {
  plano: PlanoPublico;
  intervalo: "mensal" | "anual";
  destaque: boolean;
}) {
  const sufixo = intervalo === "anual" ? "/ano" : "/mês";
  const itens = [
    p.condominiosInclusos === 1
      ? `1 condomínio incluso (até ${p.limiteCondominios})`
      : `${p.condominiosInclusos} condomínios inclusos (até ${p.limiteCondominios})`,
    ...(p.precoCondominioAdicional
      ? [
          `Condomínio adicional: ${brl(precoNoIntervalo(p.precoCondominioAdicional, intervalo))}${sufixo}`,
        ]
      : []),
    `${num(p.respostasIaMes)} respostas da IA por mês, por condomínio`,
    `${num(p.moradores)} moradores e ${p.documentos} documentos por condomínio`,
    "Respostas com citação da convenção, regimento e atas",
    "Demandas, urgências e alertas ao síndico",
  ];
  return (
    <article
      className={`flex flex-col rounded-2xl border bg-card p-6 ${
        destaque ? "border-primary shadow-card" : "border-border"
      }`}
    >
      <h2 className="text-lg font-bold text-foreground">{p.nome}</h2>
      <p className="mt-3">
        <span className="text-3xl font-bold text-foreground">
          {brl(precoNoIntervalo(p.precoMensal, intervalo))}
        </span>
        <span className="text-sm text-muted-foreground">{sufixo}</span>
      </p>
      <ul className="mt-5 flex-1 space-y-2">
        {itens.map((t) => (
          <li key={t} className="flex gap-2 text-sm text-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            {t}
          </li>
        ))}
      </ul>
      <Button asChild size="lg" variant={destaque ? "default" : "outline"} className="mt-6 w-full">
        <Link to="/cadastro" search={{ plano: p.id, intervalo }}>
          Começar 7 dias grátis
        </Link>
      </Button>
    </article>
  );
}
