/**
 * Fila (pg-boss) no mesmo Postgres, schema `pgboss`, conectando como oc_admin.
 * O web só envia; o worker (`bun run worker`) consome.
 */
import { PgBoss } from "pg-boss";

/** Fila "mensagem": um job por conversa (canal + telefone), agrupando mensagens seguidas. */
export const FILA_MENSAGEM = "mensagem";
/** Espera antes de processar, para juntar mensagens que o morador manda em sequência. */
export const AGRUPAR_SEGUNDOS = 8;

export interface JobMensagem {
  tenantId: string;
  canalId: string;
  telefone: string;
}

let boss: Promise<PgBoss> | null = null;

export function fila(): Promise<PgBoss> {
  boss ??= (async () => {
    const url = process.env.DATABASE_URL_ADMIN;
    if (!url) throw new Error("DATABASE_URL_ADMIN não definida (veja .env.example)");
    const b = new PgBoss({ connectionString: url, schema: "pgboss", createSchema: false });
    b.on("error", (e) => console.error("[fila]", e));
    await b.start();
    // stately: no máximo 1 job na fila e 1 em execução por chave; o da fila só roda depois do ativo.
    await b.createQueue(FILA_MENSAGEM, { policy: "stately" });
    // Falha (ex.: Z-API fora do ar) → 3 novas tentativas: 30 s, 60 s, 120 s.
    await b.updateQueue(FILA_MENSAGEM, { retryLimit: 3, retryDelay: 30, retryBackoff: true });
    return b;
  })().catch((e) => {
    boss = null;
    throw e;
  });
  return boss;
}

/** Agenda o processamento da conversa; se já houver um job esperando, ele leva esta mensagem junto. */
export async function enfileirarMensagem(job: JobMensagem) {
  const b = await fila();
  await b.send(FILA_MENSAGEM, job, {
    singletonKey: `${job.canalId}:${job.telefone}`,
    startAfter: AGRUPAR_SEGUNDOS,
  });
}
