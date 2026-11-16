/**
 * Tempo real: uma conexão LISTEN "eventos" por processo, repassada aos assinantes do mesmo
 * cliente (SSE em /api/eventos). Os eventos vêm dos triggers da migration 0007.
 */
import { EventEmitter } from "node:events";
import pg from "pg";

export interface Evento {
  tenant: string;
  tabela: "conversas" | "mensagens" | "demandas";
  conversa: string | null;
}

const bus = new EventEmitter().setMaxListeners(0);
let conexao: Promise<void> | null = null;

function conectar(): Promise<void> {
  conexao ??= (async () => {
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
    c.on("notification", (n) => {
      try {
        const e = JSON.parse(n.payload ?? "") as Evento;
        bus.emit(e.tenant, e);
      } catch {
        /* payload inesperado: ignora */
      }
    });
    const caiu = () => {
      conexao = null;
      // Ainda há telas abertas: reconecta sozinho.
      if (bus.eventNames().length) setTimeout(() => void conectar().catch(() => {}), 2000);
    };
    c.on("error", caiu);
    c.on("end", caiu);
    await c.connect();
    await c.query("LISTEN eventos");
  })().catch((e) => {
    conexao = null;
    throw e;
  });
  return conexao;
}

/** Recebe os eventos do cliente. Devolve a função para cancelar. */
export async function assinar(tenantId: string, fn: (e: Evento) => void): Promise<() => void> {
  bus.on(tenantId, fn);
  try {
    await conectar();
  } catch (e) {
    bus.off(tenantId, fn);
    throw e;
  }
  return () => bus.off(tenantId, fn);
}
