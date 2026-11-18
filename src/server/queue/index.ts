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
  /** Áudio: depois da transcrição, o agente responde a conversa. */
  conversaId: string;
  audio: boolean;
  url: string;
  mime: string | null;
}

/** Fila "ingestao": leitura dos documentos da base (Docling + fallback no Claude). */
export const FILA_INGESTAO = "ingestao";

export interface JobIngestao {
  tenantId: string;
  documentoId: string;
}

/** Fila "agente": uma resposta da IA por conversa (stately: a próxima espera a atual). */
export const FILA_AGENTE = "agente";

export interface JobAgente {
  tenantId: string;
  conversaId: string;
}

/** Fila "stripe": um job por evento do webhook; o worker busca o objeto atual na API. */
export const FILA_STRIPE = "stripe";

/** Job diário de inadimplência (agendado pelo worker, 6h de Brasília). */
export const FILA_INADIMPLENCIA = "inadimplencia";

export interface JobStripe {
  eventId: string;
}

/** Novas tentativas por fila (o worker sabe quando é a última). */
export const TENTATIVAS = { midia: 5, agente: 2 };

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
    await b.updateQueue(FILA_MIDIA, {
      retryLimit: TENTATIVAS.midia,
      retryDelay: 10,
      retryBackoff: true,
    });
    await b.createQueue(FILA_AGENTE, { policy: "stately" });
    // API do Claude fora do ar: 2 novas tentativas (10 s, 20 s); na última, vai para o síndico.
    await b.updateQueue(FILA_AGENTE, {
      retryLimit: TENTATIVAS.agente,
      retryDelay: 10,
      retryBackoff: true,
    });
    await b.createQueue(FILA_INGESTAO);
    // Docling fora do ar ou lento: 3 novas tentativas a partir de 1 min.
    await b.updateQueue(FILA_INGESTAO, { retryLimit: 3, retryDelay: 60, retryBackoff: true });
    await b.createQueue(FILA_ALERTA);
    // Urgência: tenta logo de novo (5 vezes, a partir de 5 s).
    await b.updateQueue(FILA_ALERTA, { retryLimit: 5, retryDelay: 5, retryBackoff: true });
    // stately: o mesmo evento reenviado pelo Stripe não vira um segundo job na fila.
    await b.createQueue(FILA_STRIPE, { policy: "stately" });
    // API do Stripe fora do ar: 5 novas tentativas a partir de 30 s.
    await b.updateQueue(FILA_STRIPE, { retryLimit: 5, retryDelay: 30, retryBackoff: true });
    // Erro de um cliente fica no log (não derruba o job); falha geral tenta de novo em 1 h.
    await b.createQueue(FILA_INADIMPLENCIA);
    await b.updateQueue(FILA_INADIMPLENCIA, { retryLimit: 2, retryDelay: 3600 });
    return b;
  })().catch((e) => {
    boss = null;
    throw e;
  });
  return boss;
}

/** Para a fila e esquece a instância: o próximo `fila()` conecta de novo (testes e worker). */
export async function pararFila(graceful = true) {
  const atual = boss;
  boss = null;
  if (atual) await (await atual).stop({ graceful });
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

export async function enfileirarStripe(job: JobStripe) {
  const b = await fila();
  await b.send(FILA_STRIPE, job, { singletonKey: job.eventId });
}

export async function enfileirarAgente(job: JobAgente) {
  const b = await fila();
  await b.send(FILA_AGENTE, job, { singletonKey: job.conversaId });
}
