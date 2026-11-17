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

/** Fila "alerta": aviso de urgência (regras fixas) aos síndicos, fora da fila de mensagens. */
export const FILA_ALERTA = "alerta";
/** Um alerta por conversa e regra a cada 30 min (o morador costuma repetir). */
const ALERTA_INTERVALO_S = 30 * 60;

export interface JobAlerta {
  tenantId: string;
  conversaId: string;
  regra: "gas" | "incendio" | "elevador" | "vazamento";
}

/** Fila "midia": baixa áudio/imagem/documento da Z-API para o S3 e transcreve áudio. */
export const FILA_MIDIA = "midia";

export interface JobMidia {
  tenantId: string;
  mensagemId: string;
  url: string;
  mime: string | null;
}

/** Fila "ingestao": leitura dos documentos da base (Docling + fallback no Claude). */
export const FILA_INGESTAO = "ingestao";

export interface JobIngestao {
  tenantId: string;
  documentoId: string;
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
    await b.createQueue(FILA_MIDIA);
    // A URL da Z-API expira: tenta logo (5 vezes, a partir de 10 s).
    await b.updateQueue(FILA_MIDIA, { retryLimit: 5, retryDelay: 10, retryBackoff: true });
    await b.createQueue(FILA_INGESTAO);
    // Docling fora do ar ou lento: 3 novas tentativas a partir de 1 min.
    await b.updateQueue(FILA_INGESTAO, { retryLimit: 3, retryDelay: 60, retryBackoff: true });
    await b.createQueue(FILA_ALERTA);
    // Urgência: tenta logo de novo (5 vezes, a partir de 5 s).
    await b.updateQueue(FILA_ALERTA, { retryLimit: 5, retryDelay: 5, retryBackoff: true });
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

export async function enfileirarAlerta(job: JobAlerta) {
  const b = await fila();
  await b.send(FILA_ALERTA, job, {
    singletonKey: `${job.conversaId}:${job.regra}`,
    singletonSeconds: ALERTA_INTERVALO_S,
  });
}

export async function enfileirarMidias(jobs: JobMidia[]) {
  if (!jobs.length) return;
  const b = await fila();
  for (const job of jobs) await b.send(FILA_MIDIA, job, { singletonKey: job.mensagemId });
}

export async function enfileirarIngestao(jobs: JobIngestao[]) {
  if (!jobs.length) return;
  const b = await fila();
  for (const job of jobs) await b.send(FILA_INGESTAO, job, { singletonKey: job.documentoId });
}
