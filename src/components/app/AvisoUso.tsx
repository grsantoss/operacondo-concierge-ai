import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { useMeuPlano } from "@/data/cobranca";
import { num } from "@/lib/planos";

/** Faixa no painel a partir de 80% das respostas da IA do mês (em 100% a IA para). */
export function AvisoUso() {
  const { data: p } = useMeuPlano();
  if (!p) return null;
  const { respostasIa: usado } = p.uso;
  const limite = p.limites.respostasIaMes;
  if (limite <= 0 || usado < limite * 0.8) return null;
  const esgotado = usado >= limite;
  return (
    <div
      role="status"
      className={`mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-3 text-sm ${
        esgotado
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-warning/40 bg-warning-soft text-foreground"
      }`}
    >
      <TriangleAlert className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        {esgotado
          ? `As ${num(limite)} respostas da IA do mês acabaram. Os moradores recebem um aviso fixo e as conversas vêm para você.`
          : `Já foram ${num(usado)} de ${num(limite)} respostas da IA neste mês.`}
      </span>
      <Link to="/app/configuracoes" search={{ aba: "plano" }} className="font-semibold underline">
        Ver plano
      </Link>
    </div>
  );
}
