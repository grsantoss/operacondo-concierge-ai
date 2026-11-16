/** Worker: consome a fila. Rodar com `bun run worker` (mesmo código e .env do web). */
import {
  enfileirarAlerta,
  fila,
  FILA_ALERTA,
  FILA_MENSAGEM,
  type JobAlerta,
  type JobMensagem,
} from "@/server/queue";
import { enviarAlerta } from "@/server/pipeline/alerta";
import { processarConversa } from "@/server/pipeline/processar";
import { rotear } from "@/server/pipeline/roteamento";

const boss = await fila();
await boss.work<JobMensagem>(FILA_MENSAGEM, async (jobs) => {
  for (const job of jobs) {
    let alerta: JobAlerta | null = null;
    const n = await processarConversa(job.data, async (entradas) => {
      alerta = await rotear(job.data, entradas);
    });
    // Depois do commit. ponytail: se este envio falhar, o alerta se perde (a mensagem já foi
    // gravada); o painel ainda mostra a conversa como Crítica.
    if (alerta) await enfileirarAlerta(alerta);
    // Sem telefone no log (LGPD).
    console.info(`[mensagem] canal ${job.data.canalId}: ${n} entrada(s) processada(s)`);
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
console.info("[worker] ouvindo as filas:", FILA_MENSAGEM, FILA_ALERTA);

for (const sinal of ["SIGINT", "SIGTERM"] as const)
  process.on(sinal, async () => {
    await boss.stop({ graceful: true });
    process.exit(0);
  });
