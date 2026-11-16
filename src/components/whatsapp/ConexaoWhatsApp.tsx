/**
 * Conexão do WhatsApp do cliente pela Z-API: credenciais, verificação e QR Code de pareamento.
 * Usado no /onboarding e em Configurações → Integrações.
 */
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/brand/Icon";
import { useCanal, useCanalAcoes } from "@/data/whatsapp";
import type { Verificacao } from "@/lib/whatsapp.functions";

const input =
  "h-10 w-full rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15";

/** A Z-API recomenda pedir o QR de novo a cada 10–20 s e parar depois de 3 tentativas sem leitura. */
const QR_INTERVALO_MS = 15_000;
const QR_TENTATIVAS = 3;

function erroAmigavel(err: unknown): string {
  const m = (err as Error).message;
  try {
    const l = JSON.parse(m) as { message: string }[];
    if (Array.isArray(l)) return l.map((x) => x.message).join(" ");
  } catch {
    /* mensagem comum */
  }
  return m;
}

export function ConexaoWhatsApp() {
  const { canal, carregando } = useCanal();
  if (carregando)
    return <p className="text-sm text-[var(--color-on-surface-variant)]">Carregando…</p>;
  // key: ao salvar outro número/instância, o formulário recomeça com os dados gravados
  return <Formulario key={`${canal?.telefone}|${canal?.instanceId}`} />;
}

function Formulario() {
  const { canal } = useCanal();
  const { salvar, verificar, desconectar } = useCanalAcoes();
  const [f, setF] = useState({
    telefone: canal?.telefone ?? "",
    instanceId: canal?.instanceId ?? "",
    token: "",
    clientToken: "",
  });
  const [ocupado, setOcupado] = useState<null | "salvar" | "verificar" | "desconectar">(null);
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<Verificacao | null>(null);
  const tentativas = useRef(0);
  const conectado = res ? res.conectado : canal?.status === "conectado";
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function acao(tipo: "salvar" | "verificar" | "desconectar", fn: () => Promise<void>) {
    setErro(null);
    setOcupado(tipo);
    try {
      await fn();
    } catch (err) {
      setErro(erroAmigavel(err));
    } finally {
      setOcupado(null);
    }
  }

  const checar = () =>
    acao("verificar", async () => {
      setRes(await verificar());
    });

  // Enquanto o QR estiver na tela, pede um novo a cada 15 s (no máximo 3 vezes).
  useEffect(() => {
    if (!res?.qrCode || res.conectado) return;
    if (tentativas.current >= QR_TENTATIVAS) return;
    const t = setTimeout(() => {
      tentativas.current += 1;
      void verificar()
        .then(setRes)
        .catch((err) => setErro(erroAmigavel(err)));
    }, QR_INTERVALO_MS);
    return () => clearTimeout(t);
  }, [res, verificar]);

  const qrExpirou = !!res?.qrCode && !res.conectado && tentativas.current >= QR_TENTATIVAS;

  return (
    <div className="card-elev rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-navy)]">WhatsApp pela Z-API</h3>
          <p className="text-xs text-[var(--color-on-surface-variant)]">
            Um número para todos os seus condomínios. Instance ID e Token ficam no painel da Z-API
            em Instâncias; o Client-Token, em Segurança.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            conectado
              ? "bg-success/10 text-success-strong"
              : "bg-[var(--color-surface-mid)] text-[var(--color-on-surface-variant)]"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${conectado ? "bg-success" : "bg-muted-foreground"}`}
          />
          {conectado ? "Conectado" : canal ? "Não conectado" : "Não configurado"}
        </span>
      </div>

      <form
        className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void acao("salvar", async () => {
            await salvar(f);
            setRes(null);
            tentativas.current = 0;
          });
        }}
      >
        <Campo label="Número do WhatsApp" hint="Com DDD. É o número que os moradores vão chamar.">
          <input
            className={input}
            inputMode="tel"
            placeholder="(11) 98888-7777"
            value={f.telefone}
            onChange={(e) => set("telefone", e.target.value)}
          />
        </Campo>
        <Campo label="Instance ID">
          <input
            className={input}
            value={f.instanceId}
            onChange={(e) => set("instanceId", e.target.value)}
          />
        </Campo>
        <Campo
          label="Token da instância"
          hint={canal ? "Deixe em branco para manter o token salvo." : undefined}
        >
          <input
            className={input}
            type="password"
            autoComplete="off"
            placeholder={canal ? "•••••••• (salvo)" : ""}
            value={f.token}
            onChange={(e) => set("token", e.target.value)}
          />
        </Campo>
        <Campo
          label="Client-Token (segurança da conta)"
          hint={
            canal?.temClientToken
              ? "Deixe em branco para manter o salvo."
              : "Obrigatório se ativado na Z-API."
          }
        >
          <input
            className={input}
            type="password"
            autoComplete="off"
            placeholder={canal?.temClientToken ? "•••••••• (salvo)" : ""}
            value={f.clientToken}
            onChange={(e) => set("clientToken", e.target.value)}
          />
        </Campo>

        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={!!ocupado}
            className="btn-press inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-3 text-xs font-semibold text-white hover:bg-[var(--color-brand-hover)] disabled:opacity-60"
          >
            <Icon name="save" className="text-[16px]" />
            {ocupado === "salvar" ? "Salvando…" : "Salvar credenciais"}
          </button>
          {canal ? (
            <button
              type="button"
              onClick={() => {
                tentativas.current = 0;
                void checar();
              }}
              disabled={!!ocupado}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-3 text-xs font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)] disabled:opacity-60"
            >
              <Icon name="bolt" className="text-[16px]" />
              {ocupado === "verificar"
                ? "Verificando…"
                : conectado
                  ? "Verificar de novo"
                  : "Conectar / verificar"}
            </button>
          ) : null}
          {canal && conectado ? (
            <button
              type="button"
              onClick={() =>
                void acao("desconectar", async () => {
                  await desconectar();
                  setRes(null);
                })
              }
              disabled={!!ocupado}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-destructive/30 bg-white px-3 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              Desconectar
            </button>
          ) : null}
          <a
            href="https://developer.z-api.io"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--color-brand)] hover:underline"
          >
            Como obter <Icon name="open_in_new" className="text-[14px]" />
          </a>
        </div>
      </form>

      {erro ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {erro}
        </p>
      ) : null}
      {res?.aviso ? (
        <p role="status" className="mt-3 text-sm text-warning-strong">
          {res.aviso}
        </p>
      ) : null}
      {conectado && !res?.aviso && canal?.conectadoEm ? (
        <p className="mt-3 text-xs text-[var(--color-on-surface-variant)]">
          Conectado desde {new Date(canal.conectadoEm).toLocaleString("pt-BR")}.
        </p>
      ) : null}

      {res?.qrCode && !res.conectado ? (
        <div className="mt-4 flex flex-col items-center gap-4 rounded-xl border border-dashed border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] p-4 sm:flex-row">
          <img
            src={res.qrCode}
            alt="QR Code para conectar o WhatsApp"
            className={`h-40 w-40 shrink-0 rounded-lg bg-white p-1 ${qrExpirou ? "opacity-30" : ""}`}
          />
          <div className="text-xs text-[var(--color-on-surface-variant)]">
            {qrExpirou ? (
              <p>O QR Code expirou. Clique em “Conectar / verificar” para gerar outro.</p>
            ) : (
              <p>
                No celular do número informado, abra o WhatsApp → Aparelhos conectados → Conectar um
                aparelho e escaneie. O código se renova sozinho por alguns instantes.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Campo({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--color-navy)]">{label}</span>
      {children}
      {hint ? (
        <span className="mt-1 block text-[11px] text-[var(--color-on-surface-variant)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
