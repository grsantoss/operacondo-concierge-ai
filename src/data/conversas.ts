import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  assumirConversa,
  listarConversas,
  listarMensagens,
  resolverConversa,
  responderConversa,
  type EstadoConversa,
} from "@/lib/conversas.functions";

export type { ConversaResumo, MensagemConversa } from "@/lib/conversas.functions";

export const ESTADO_LABEL: Record<EstadoConversa, string> = {
  ia: "IA atendendo",
  aguardando_sindico: "Aguardando síndico",
  sindico: "Síndico no controle",
  resolvida: "Resolvido",
};

export const conversasQuery = queryOptions({
  queryKey: ["conversas"],
  queryFn: () => listarConversas(),
});

export const mensagensQuery = (id: string) =>
  queryOptions({
    queryKey: ["mensagens", id],
    queryFn: () => listarMensagens({ data: { id } }),
  });

export const useConversas = () => useQuery(conversasQuery);
export const useMensagens = (id: string | null) =>
  useQuery({ ...mensagensQuery(id ?? ""), enabled: !!id });

/** Escuta /api/eventos e atualiza a lista e as mensagens da conversa que mudou. */
export function useConversasAoVivo() {
  const qc = useQueryClient();
  useEffect(() => {
    const es = new EventSource("/api/eventos");
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as { tabela: string; conversa: string | null };
      void qc.invalidateQueries({ queryKey: conversasQuery.queryKey });
      // O cadastro pelo WhatsApp (#28) acontece numa conversa: o selo de pendentes acompanha.
      void qc.invalidateQueries({ queryKey: ["cadastros-pendentes"] });
      if (e.conversa && e.tabela === "mensagens")
        void qc.invalidateQueries({ queryKey: ["mensagens", e.conversa] });
    };
    return () => es.close();
  }, [qc]);
}

export function useConversaAcoes() {
  const qc = useQueryClient();
  const recarregar = (id: string) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: conversasQuery.queryKey }),
      qc.invalidateQueries({ queryKey: ["mensagens", id] }),
    ]);
  return {
    async responder(id: string, texto: string) {
      await responderConversa({ data: { id, texto } });
      await recarregar(id);
    },
    async assumir(id: string) {
      await assumirConversa({ data: { id } });
      await recarregar(id);
    },
    async resolver(id: string) {
      await resolverConversa({ data: { id } });
      await recarregar(id);
    },
  };
}
