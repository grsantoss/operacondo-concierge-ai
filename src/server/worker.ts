/** Worker: consome a fila. Rodar com `bun run worker` (mesmo código e .env do web). */
import { fila, FILA_MENSAGEM, type JobMensagem } from "@/server/queue";
import { processarConversa } from "@/server/pipeline/processar";

const boss = await fila();
await boss.work<JobMensagem>(FILA_MENSAGEM, async (jobs) => {
  for (const job of jobs) {
    const n = await processarConversa(job.data);
    // Sem telefone no log (LGPD).
    console.info(`[mensagem] canal ${job.data.canalId}: ${n} entrada(s) processada(s)`);
  }
});
console.info("[worker] ouvindo a fila:", FILA_MENSAGEM);

for (const sinal of ["SIGINT", "SIGTERM"] as const)
  process.on(sinal, async () => {
    await boss.stop({ graceful: true });
    process.exit(0);
  });
