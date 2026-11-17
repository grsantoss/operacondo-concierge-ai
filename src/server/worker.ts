/** Worker: consome a fila. Rodar com `bun run worker` (mesmo código e .env do web). */
import { responder } from "@/server/agent/run";
import { iaConfigurada } from "@/server/llm";
import {
  enfileirarAgente,
  enfileirarAlerta,
  enfileirarMidias,
  fila,
  FILA_AGENTE,
  FILA_ALERTA,
  FILA_MENSAGEM,
  FILA_INGESTAO,
  FILA_MIDIA,
  TENTATIVAS,
  type JobAgente,
  type JobAlerta,
  type JobMensagem,
  type JobIngestao,
  type JobMidia,
} from "@/server/queue";
import { ingerirDocumento } from "@/server/ingest";
import { enviarAlerta } from "@/server/pipeline/alerta";
import { processarMidia } from "@/server/pipeline/midia";
import { processarConversa } from "@/server/pipeline/processar";
import { rotear, type Roteado } from "@/server/pipeline/roteamento";

const boss = await fila();
await boss.work<JobMensagem>(FILA_MENSAGEM, async (jobs) => {
  for (const job of jobs) {
    let res: Roteado | null = null;
    const n = await processarConversa(job.data, async (entradas) => {
      res = await rotear(job.data, entradas);
    });
    const { alerta, midias, agente } = (res as Roteado | null) ?? {
      alerta: null,
      midias: [],
      agente: null,
    };
    // Depois do commit. ponytail: se este envio falhar, o alerta se perde (a mensagem já foi
    // gravada); o painel ainda mostra a conversa como Crítica.
    if (alerta) await enfileirarAlerta(alerta);
    await enfileirarMidias(midias);
    if (agente) await enfileirarAgente(agente);
    // Sem telefone no log (LGPD).
    console.info(`[mensagem] canal ${job.data.canalId}: ${n} entrada(s) processada(s)`);
  }
});
await boss.work<JobMidia>(FILA_MIDIA, async (jobs) => {
  for (const job of jobs) {
    // Áudio: o agente responde depois da transcrição, ou sem ela se o download falhar de vez.
    const responderAudio = () =>
      job.data.audio && iaConfigurada()
        ? enfileirarAgente({ tenantId: job.data.tenantId, conversaId: job.data.conversaId })
        : undefined;
    try {
      const { alerta } = await processarMidia(job.data);
      if (alerta) await enfileirarAlerta(alerta);
    } catch (e) {
      if (job.retryCount >= TENTATIVAS.midia) await responderAudio();
      throw e;
    }
    await responderAudio();
    console.info(`[midia] mensagem ${job.data.mensagemId} guardada`);
  }
});
await boss.work<JobAgente>(FILA_AGENTE, async (jobs) => {
  for (const job of jobs) {
    await responder(job.data, job.retryCount >= TENTATIVAS.agente);
    console.info(`[agente] conversa ${job.data.conversaId} respondida`);
  }
});
await boss.work<JobIngestao>(FILA_INGESTAO, async (jobs) => {
  for (const job of jobs) {
    await ingerirDocumento(job.data);
    console.info(`[ingestao] documento ${job.data.documentoId} lido`);
  }
});
await boss.work<JobAlerta>(FILA_ALERTA, async (jobs) => {
  for (const job of jobs) {
    const n = await enviarAlerta(job.data);
    console.info(
      `[alerta] ${job.data.regra} na conversa ${job.data.conversaId}: ${n} síndico(s) avisado(s)`,
    );
  }
});
console.info(
  "[worker] ouvindo as filas:",
  FILA_MENSAGEM,
  FILA_MIDIA,
  FILA_AGENTE,
  FILA_ALERTA,
  FILA_INGESTAO,
);

for (const sinal of ["SIGINT", "SIGTERM"] as const)
  process.on(sinal, async () => {
    await boss.stop({ graceful: true });
    process.exit(0);
  });
