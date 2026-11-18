/** Peças de cobrança do Admin Master: forma de cobrança, ações da assinatura, avulsa, fatura e NFS-e. */
import { useState } from "react";
import { Icon } from "@/components/brand/Icon";
import type { Fatura } from "@/data/faturas";
import { erroAmigavel, useClientesAcoes, type Tenant } from "@/data/tenants";

export interface Cobranca {
  intervalo: "mensal" | "anual";
  forma: "cartao" | "boleto";
  diasParaPagar: number;
}

const campo =
  "h-10 w-full rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm outline-none focus:border-[var(--color-brand)]";
const botao =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-xs font-semibold text-[var(--color-navy)] hover:bg-[var(--color-surface-mid)] disabled:opacity-50";
const primario =
  "inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover)] disabled:opacity-60";

function Rotulo({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--color-navy)]">{texto}</span>
      {children}
    </label>
  );
}

export function EscolhaCobranca({
  valor,
  onChange,
}: {
  valor: Cobranca;
  onChange: (c: Cobranca) => void;
}) {
  const set = (p: Partial<Cobranca>) => onChange({ ...valor, ...p });
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Rotulo texto="Intervalo">
        <select
          className={campo}
          value={valor.intervalo}
          onChange={(e) => set({ intervalo: e.target.value as Cobranca["intervalo"] })}
        >
          <option value="mensal">Mensal</option>
          <option value="anual">Anual (paga 10, leva 12)</option>
        </select>
      </Rotulo>
      <Rotulo texto="Forma de cobrança">
        <select
          className={campo}
          value={valor.forma}
          onChange={(e) => set({ forma: e.target.value as Cobranca["forma"] })}
        >
          <option value="cartao">Cartão (link do Stripe)</option>
          <option value="boleto">Boleto (fatura por e-mail)</option>
        </select>
      </Rotulo>
      {valor.forma === "boleto" ? (
        <Rotulo texto="Dias para pagar">
          <input
            type="number"
            min={1}
            max={60}
            className={campo}
            value={valor.diasParaPagar}
            onChange={(e) => set({ diasParaPagar: Number(e.target.value) || 7 })}
          />
        </Rotulo>
      ) : null}
    </div>
  );
}

/** Executa uma ação e guarda erro/sucesso para mostrar ao lado. */
function useAcao() {
  const [estado, setEstado] = useState<{ ocupado: boolean; msg: string | null; ok: boolean }>({
    ocupado: false,
    msg: null,
    ok: true,
  });
  async function rodar(fn: () => Promise<unknown>, sucesso: string) {
    setEstado({ ocupado: true, msg: null, ok: true });
    try {
      await fn();
      setEstado({ ocupado: false, msg: sucesso, ok: true });
      return true;
    } catch (err) {
      setEstado({ ocupado: false, msg: erroAmigavel(err), ok: false });
      return false;
    }
  }
  return { ...estado, rodar };
}

function Mensagem({ msg, ok }: { msg: string | null; ok: boolean }) {
  if (!msg) return null;
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`mt-3 text-sm ${ok ? "text-success-strong" : "text-destructive"}`}
    >
      {msg}
    </p>
  );
}

const ENCERRADA = new Set(["canceled", "incomplete_expired", null]);

/** Criar assinatura (se não houver ativa) ou cancelar a atual. */
export function AssinaturaAcoes({ t, planoId }: { t: Tenant; planoId: string }) {
  const { assinar, cancelar } = useClientesAcoes();
  const a = useAcao();
  const [cobranca, setCobranca] = useState<Cobranca>({
    intervalo: "mensal",
    forma: "cartao",
    diasParaPagar: 7,
  });
  const [link, setLink] = useState<string | null>(null);

  if (ENCERRADA.has(t.assinaturaStatus)) {
    return (
      <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-6">
        <h3 className="text-base font-bold text-[var(--color-navy)]">Criar assinatura</h3>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          No plano selecionado acima. Trial de 7 dias se o CNPJ ainda não teve teste.
        </p>
        <div className="mt-4">
          <EscolhaCobranca valor={cobranca} onChange={setCobranca} />
        </div>
        <button
          className={`${primario} mt-4`}
          disabled={a.ocupado || !planoId}
          onClick={() =>
            a.rodar(async () => {
              const r = await assinar({ tenantId: t.id, planoId, ...cobranca });
              setLink(r.link);
            }, "Assinatura criada.")
          }
        >
          <Icon name="credit_card" className="text-[16px]" />
          {cobranca.forma === "cartao" ? "Gerar link de pagamento" : "Criar assinatura por boleto"}
        </button>
        {link ? (
          <p className="mt-3 break-all rounded-lg bg-[var(--color-surface-low)] p-3 font-mono text-xs">
            {link}
          </p>
        ) : null}
        <Mensagem msg={a.msg} ok={a.ok} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className={botao}
        disabled={a.ocupado}
        onClick={() => {
          if (confirm("Cancelar a assinatura no fim do período já pago?"))
            void a.rodar(
              () => cancelar({ tenantId: t.id }),
              "Assinatura cancelada no fim do período.",
            );
        }}
      >
        <Icon name="cancel" className="text-[14px]" /> Cancelar no fim do período
      </button>
      <button
        className={`${botao} text-destructive`}
        disabled={a.ocupado}
        onClick={() => {
          if (confirm("Cancelar a assinatura AGORA? O acesso termina imediatamente."))
            void a.rodar(() => cancelar({ tenantId: t.id, agora: true }), "Assinatura cancelada.");
        }}
      >
        <Icon name="cancel" className="text-[14px]" /> Cancelar agora
      </button>
      <Mensagem msg={a.msg} ok={a.ok} />
    </div>
  );
}

export function CobrancaAvulsaForm({ tenantId }: { tenantId: string }) {
  const { cobrancaAvulsa } = useClientesAcoes();
  const a = useAcao();
  const [d, setD] = useState({ descricao: "", valor: "", diasParaPagar: 7 });
  return (
    <form
      className="rounded-2xl border border-[var(--color-outline-variant)] bg-white p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await a.rodar(
          () =>
            cobrancaAvulsa({
              tenantId,
              descricao: d.descricao,
              valor: Number(d.valor.replace(/\./g, "").replace(",", ".")),
              diasParaPagar: d.diasParaPagar,
            }),
          "Cobrança enviada ao e-mail do cliente.",
        );
        if (ok) setD({ descricao: "", valor: "", diasParaPagar: 7 });
      }}
    >
      <h3 className="text-base font-bold text-[var(--color-navy)]">Cobrança avulsa</h3>
      <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
        Fatura única enviada pelo Stripe por e-mail (boleto; Pix se estiver ligado).
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_120px]">
        <Rotulo texto="Descrição">
          <input
            className={campo}
            value={d.descricao}
            onChange={(e) => setD({ ...d, descricao: e.target.value })}
            placeholder="Implantação, treinamento…"
          />
        </Rotulo>
        <Rotulo texto="Valor (R$)">
          <input
            className={campo}
            inputMode="decimal"
            value={d.valor}
            onChange={(e) => setD({ ...d, valor: e.target.value })}
            placeholder="0,00"
          />
        </Rotulo>
        <Rotulo texto="Dias para pagar">
          <input
            type="number"
            min={1}
            max={60}
            className={campo}
            value={d.diasParaPagar}
            onChange={(e) => setD({ ...d, diasParaPagar: Number(e.target.value) || 7 })}
          />
        </Rotulo>
      </div>
      <button type="submit" className={`${primario} mt-4`} disabled={a.ocupado}>
        <Icon name="send" className="text-[16px]" /> Enviar cobrança
      </button>
      <Mensagem msg={a.msg} ok={a.ok} />
    </form>
  );
}

const PERGUNTA = {
  marcar_paga: "Marcar a fatura como paga fora do Stripe (dinheiro já recebido por outro meio)?",
  anular: "Anular a fatura? Ela deixa de ser cobrada.",
  estornar: "Estornar o valor total desta fatura ao cliente?",
} as const;

/** Botões de uma fatura: reenviar, marcar paga, anular (em aberto) ou estornar (paga). */
export function FaturaAcoes({ f }: { f: Fatura }) {
  const { acaoFatura } = useClientesAcoes();
  const a = useAcao();
  const aberta = f.status === "open" || f.status === "past_due";
  const fazer = (acao: "reenviar" | keyof typeof PERGUNTA, ok: string) => {
    if (acao !== "reenviar" && !confirm(PERGUNTA[acao])) return;
    void a.rodar(() => acaoFatura({ faturaId: f.id, acao }), ok);
  };
  if (!f.stripeInvoiceId) return null;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="inline-flex flex-wrap justify-end gap-1">
        {aberta ? (
          <>
            <button
              className={botao}
              disabled={a.ocupado}
              onClick={() => fazer("reenviar", "Reenviada.")}
            >
              Reenviar
            </button>
            <button
              className={botao}
              disabled={a.ocupado}
              onClick={() => fazer("marcar_paga", "Marcada como paga.")}
            >
              Marcar paga
            </button>
            <button
              className={botao}
              disabled={a.ocupado}
              onClick={() => fazer("anular", "Anulada.")}
            >
              Anular
            </button>
          </>
        ) : null}
        {f.status === "paid" ? (
          <button
            className={botao}
            disabled={a.ocupado}
            onClick={() => fazer("estornar", "Estornada.")}
          >
            Estornar
          </button>
        ) : null}
      </div>
      {a.msg ? (
        <span className={`text-xs ${a.ok ? "text-success-strong" : "text-destructive"}`}>
          {a.msg}
        </span>
      ) : null}
    </div>
  );
}

/** NFS-e manual: "nota pendente" em fatura paga, com número e data da nota. */
export function NotaFiscal({ f }: { f: Fatura }) {
  const { registrarNfse } = useClientesAcoes();
  const a = useAcao();
  const [editando, setEditando] = useState(false);
  const [numero, setNumero] = useState(f.nfseNumero);
  const [data, setData] = useState(f.nfseEmitidaEm || new Date().toISOString().slice(0, 10));
  if (f.status !== "paid")
    return <span className="text-xs text-[var(--color-on-surface-variant)]">—</span>;
  if (!editando)
    return (
      <button
        onClick={() => setEditando(true)}
        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
          f.nfseNumero
            ? "bg-[var(--color-success-soft)] text-[var(--color-success-strong)]"
            : "bg-[var(--color-warning-soft)] text-[var(--color-warning-strong)]"
        }`}
        title="Registrar ou alterar a nota"
      >
        {f.nfseNumero ? `NF ${f.nfseNumero}` : "Nota pendente"}
      </button>
    );
  return (
    <form
      className="flex flex-wrap items-center gap-1"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await a.rodar(
            () => registrarNfse({ faturaId: f.id, numero, emitidaEm: numero ? data : null }),
            "Salvo.",
          )
        )
          setEditando(false);
      }}
    >
      <input
        aria-label="Número da nota"
        className="h-8 w-24 rounded-md border border-[var(--color-outline-variant)] px-2 text-xs"
        value={numero}
        onChange={(e) => setNumero(e.target.value)}
        placeholder="Número"
      />
      <input
        aria-label="Data de emissão"
        type="date"
        className="h-8 rounded-md border border-[var(--color-outline-variant)] px-2 text-xs"
        value={data}
        onChange={(e) => setData(e.target.value)}
      />
      <button type="submit" className={botao} disabled={a.ocupado}>
        Salvar
      </button>
      {a.msg && !a.ok ? <span className="text-xs text-destructive">{a.msg}</span> : null}
    </form>
  );
}
