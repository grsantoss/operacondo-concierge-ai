import { useState } from "react";
import { CreditCard, ExternalLink, FileDown, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useMeuPlano } from "@/data/cobranca";
import { abrirPortal, type FaturaResumo, type MeuPlano } from "@/lib/cobranca.functions";
import { brl, mensagem, num } from "@/lib/planos";

const STATUS_ASSINATURA: Record<string, string> = {
  trialing: "Teste grátis",
  active: "Ativa",
  past_due: "Pagamento atrasado",
  unpaid: "Não paga",
  canceled: "Cancelada",
  incomplete: "Pagamento pendente",
  incomplete_expired: "Expirada",
  paused: "Pausada",
};

const data = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR") : "—";

function rotuloFatura(f: FaturaResumo): { texto: string; cor: string } {
  if (f.vencida) return { texto: "Vencida", cor: "bg-destructive/10 text-destructive" };
  if (f.status === "paid") return { texto: "Paga", cor: "bg-success/10 text-success-strong" };
  if (f.status === "open") return { texto: "Em aberto", cor: "bg-warning-soft text-foreground" };
  if (f.status === "void") return { texto: "Anulada", cor: "bg-muted text-muted-foreground" };
  if (f.status === "uncollectible")
    return { texto: "Não cobrável", cor: "bg-muted text-muted-foreground" };
  return { texto: "Rascunho", cor: "bg-muted text-muted-foreground" };
}

function Uso({ label, usado, limite }: { label: string; usado: number; limite: number }) {
  const pct = limite > 0 ? Math.min(100, Math.round((usado / limite) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className={pct >= 80 ? "font-semibold text-destructive" : "text-muted-foreground"}>
          {num(usado)} de {num(limite)}
        </span>
      </div>
      <Progress value={pct} aria-label={`${label}: ${pct}%`} />
    </div>
  );
}

function Resumo({ p }: { p: MeuPlano }) {
  const trial = p.status === "trialing";
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plano</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-lg font-semibold text-foreground">
          {p.plano}
          <Badge variant="secondary">{STATUS_ASSINATURA[p.status] ?? p.status}</Badge>
        </p>
        <p className="text-xs text-muted-foreground">
          {p.intervalo === "anual" ? "Anual" : "Mensal"} · até {num(p.limites.condominios)}{" "}
          {p.limites.condominios === 1 ? "condomínio" : "condomínios"}
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {trial ? "Teste termina em" : p.cancelaNoFim ? "Acesso até" : "Próxima cobrança"}
        </p>
        <p className="mt-1 text-lg font-semibold text-foreground">
          {data(trial ? p.trialFim : p.periodoFim)}
        </p>
        {p.proximaCobranca != null && !p.cancelaNoFim ? (
          <p className="text-xs text-muted-foreground">
            {trial ? "Primeira cobrança de " : ""}
            {brl(p.proximaCobranca)}
          </p>
        ) : null}
      </div>
      {p.cancelaNoFim ? (
        <p className="text-sm text-destructive sm:col-span-3">
          A assinatura foi cancelada e termina no fim do período já pago.
        </p>
      ) : null}
      {trial ? (
        <p className="text-sm text-muted-foreground sm:col-span-3">
          No teste grátis valem limites reduzidos. Depois dele, valem os do plano {p.plano}.
        </p>
      ) : null}
    </div>
  );
}

export function PlanoCobranca() {
  const { data: p, isLoading } = useMeuPlano();
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerenciar() {
    setErro(null);
    setAbrindo(true);
    try {
      const { url } = await abrirPortal();
      window.location.href = url;
    } catch (err) {
      setErro(mensagem(err));
      setAbrindo(false);
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando o plano…</p>;
  if (!p)
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Nenhuma assinatura encontrada.
      </div>
    );

  const l = p.limites;
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Plano e cobrança</h2>
            <p className="text-xs text-muted-foreground">
              Cartão, faturas e cancelamento ficam no portal seguro do Stripe.
            </p>
          </div>
          {p.podeGerenciar ? (
            <Button onClick={gerenciar} disabled={abrindo}>
              {abrindo ? <Loader2 className="animate-spin" /> : <CreditCard />}
              Gerenciar pagamento
            </Button>
          ) : null}
        </header>
        <div className="px-5 py-5">
          <Resumo p={p} />
          {erro ? <p className="mt-3 text-sm text-destructive">{erro}</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Uso do mês</h2>
          <p className="text-xs text-muted-foreground">
            Respostas da IA zeram no dia 1º de cada mês.
          </p>
        </header>
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
          <Uso label="Respostas da IA" usado={p.uso.respostasIa} limite={l.respostasIaMes} />
          <Uso label="Condomínios" usado={p.uso.condominios} limite={l.condominios} />
          <Uso label="Moradores" usado={p.uso.moradores} limite={l.moradores} />
          <Uso label="Documentos na base" usado={p.uso.documentos} limite={l.documentos} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Faturas</h2>
        </header>
        {p.faturas.length === 0 ? (
          <p className="px-5 py-5 text-sm text-muted-foreground">Nenhuma fatura ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {p.faturas.map((f) => {
              const r = rotuloFatura(f);
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {brl(f.valorTotal)}
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${r.cor}`}
                      >
                        {r.texto}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {f.numero ? `${f.numero} · ` : ""}
                      {f.pagoEm ? `paga em ${data(f.pagoEm)}` : `vence em ${data(f.vencimento)}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {f.urlFatura ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={f.urlFatura} target="_blank" rel="noreferrer">
                          <ExternalLink />
                          {f.status === "open" ? "Pagar" : "Ver"}
                        </a>
                      </Button>
                    ) : null}
                    {f.urlPdf ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={f.urlPdf} target="_blank" rel="noreferrer" aria-label="Baixar PDF">
                          <FileDown />
                          PDF
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
