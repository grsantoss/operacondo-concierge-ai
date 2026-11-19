/**
 * Endereço de atendimento por e-mail (#82): o síndico divulga ou encaminha o e-mail atual do
 * condomínio para ele. Usado no /onboarding e em Configurações → Integrações.
 */
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Copy, Mail } from "lucide-react";
import { useState } from "react";
import { obterCanalEmail } from "@/lib/email.functions";

export const canalEmailQuery = queryOptions({
  queryKey: ["email-canal"],
  queryFn: () => obterCanalEmail(),
});

export function CanalEmail() {
  const { data: canal, isPending, error } = useQuery(canalEmailQuery);
  const [copiado, setCopiado] = useState(false);

  return (
    <div className="card-elev rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Mail className="size-4" aria-hidden /> Atendimento por e-mail
          </h3>
          <p className="text-xs text-muted-foreground">
            Os e-mails que chegarem neste endereço entram em Conversas, junto com o WhatsApp. As
            respostas saem dele, na mesma conversa.
          </p>
        </div>
        {canal ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              canal.recebendo
                ? "bg-success/10 text-success-strong"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${canal.recebendo ? "bg-success" : "bg-muted-foreground"}`}
            />
            {canal.recebendo ? "Recebendo" : "Aguardando o 1º e-mail"}
          </span>
        ) : null}
      </div>

      {isPending ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-destructive">{(error as Error).message}</p>
      ) : !canal ? (
        <p className="mt-4 text-sm text-muted-foreground">
          O atendimento por e-mail ainda não está disponível nesta instalação.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <code className="min-w-0 break-all rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground">
              {canal.endereco}
            </code>
            <button
              type="button"
              onClick={() =>
                void navigator.clipboard.writeText(canal.endereco).then(() => {
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 2000);
                })
              }
              className="btn-press inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-foreground"
            >
              <Copy className="size-3.5" aria-hidden /> {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
          {canal.ultimoRecebidoEm ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Último e-mail recebido em{" "}
              {new Date(canal.ultimoRecebidoEm).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
              .
            </p>
          ) : null}

          <div className="mt-4 space-y-2 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Como usar</p>
            <p>
              Divulgue este endereço aos moradores ou encaminhe para ele o e-mail que o condomínio
              já usa:
            </p>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                <span className="font-semibold text-foreground">Gmail:</span> Configurações → Ver
                todas as configurações → Encaminhamento e POP/IMAP → Adicionar endereço de
                encaminhamento. O Gmail manda um código de confirmação, que aparece aqui em
                Conversas.
              </li>
              <li>
                <span className="font-semibold text-foreground">Outlook:</span> Configurações →
                Email → Encaminhamento → Habilitar encaminhamento, com este endereço.
              </li>
            </ul>
            <p>
              O morador é reconhecido pelo e-mail do cadastro em Moradores. Respostas pedem a sua
              aprovação, a menos que o envio automático esteja ligado em Agente IA.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
