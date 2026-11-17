/**
 * Cadastros feitos pelo agente no 1º contato do WhatsApp, esperando o síndico (#28). Aprovar
 * libera, no agente, demandas próprias, regras de moradores e dados da unidade.
 */
import { Check, UserPlus, X } from "lucide-react";
import { useState } from "react";
import {
  formatEndereco,
  useCadastroAcoes,
  usePendentes,
  type Endereco,
  type Pendente,
} from "@/data/moradores";

const campo =
  "h-9 w-full rounded-lg border border-border bg-white px-2 text-sm outline-none focus:border-primary";

export function CadastrosPendentes({ condoId }: { condoId: string }) {
  const pendentes = usePendentes().filter((p) => condoId === "all" || p.condominioId === condoId);
  if (!pendentes.length) return null;
  return (
    <section
      aria-label="Cadastros pendentes"
      className="mb-5 rounded-xl border border-warning/40 bg-warning-soft p-4"
    >
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
        <UserPlus className="size-4" aria-hidden /> Cadastros pelo WhatsApp esperando aprovação (
        {pendentes.length})
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Até aprovar, o agente responde só regras públicas e abre demandas. Confira a unidade com o
        que o morador informou.
      </p>
      <ul className="space-y-2">
        {pendentes.map((p) => (
          <Linha key={p.id} p={p} />
        ))}
      </ul>
    </section>
  );
}

function Linha({ p }: { p: Pendente }) {
  const decidir = useCadastroAcoes();
  const [end, setEnd] = useState<Endereco>(
    p.tipo === "horizontal"
      ? { tipo: "horizontal", quadra: "", casa: "" }
      : { tipo: "vertical", bloco: "", andar: 0, apto: "" },
  );
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const completo =
    end.tipo === "vertical"
      ? !!(end.bloco.trim() && end.apto.trim())
      : !!(end.quadra.trim() && end.casa.trim());

  async function agir(decisao: "aprovar" | "recusar") {
    if (decisao === "recusar" && !confirm(`Recusar o cadastro de ${p.nome}?`)) return;
    setOcupado(true);
    setErro(null);
    try {
      await decidir(p.id, decisao, decisao === "aprovar" && !p.unidade ? end : undefined);
    } catch (e) {
      setErro((e as Error).message);
      setOcupado(false);
    }
  }

  return (
    <li className="rounded-lg border border-border bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {p.nome} <span className="font-normal text-muted-foreground">· {p.vinculo}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {p.contato} · {p.condominio} · {new Date(p.criadoEm).toLocaleDateString("pt-BR")}
          </p>
          <p className="mt-1 text-xs text-foreground">
            Informou: <strong>{p.unidadeInformada ?? "—"}</strong>
            {p.unidade && <> · ligado a {formatEndereco(p.unidade)}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={ocupado}
            onClick={() => agir("recusar")}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          >
            <X className="size-4" aria-hidden /> Recusar
          </button>
          <button
            type="button"
            disabled={ocupado || (!p.unidade && !completo)}
            onClick={() => agir("aprovar")}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Check className="size-4" aria-hidden /> Aprovar
          </button>
        </div>
      </div>
      {!p.unidade && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {end.tipo === "vertical" ? (
            <>
              <input
                aria-label="Bloco"
                placeholder="Bloco"
                className={campo}
                value={end.bloco}
                onChange={(e) => setEnd({ ...end, bloco: e.target.value })}
              />
              <input
                aria-label="Andar"
                placeholder="Andar"
                inputMode="numeric"
                className={campo}
                value={end.andar || ""}
                onChange={(e) =>
                  setEnd({ ...end, andar: Number(e.target.value.replace(/\D/g, "")) || 0 })
                }
              />
              <input
                aria-label="Apto"
                placeholder="Apto"
                className={campo}
                value={end.apto}
                onChange={(e) => setEnd({ ...end, apto: e.target.value })}
              />
            </>
          ) : (
            <>
              <input
                aria-label="Quadra"
                placeholder="Quadra"
                className={campo}
                value={end.quadra}
                onChange={(e) => setEnd({ ...end, quadra: e.target.value })}
              />
              <input
                aria-label="Casa"
                placeholder="Casa"
                className={campo}
                value={end.casa}
                onChange={(e) => setEnd({ ...end, casa: e.target.value })}
              />
            </>
          )}
        </div>
      )}
      {erro && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {erro}
        </p>
      )}
    </li>
  );
}
