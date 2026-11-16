import { createFileRoute } from "@tanstack/react-router";
import { lerContexto } from "@/server/auth/contexto";
import { assinar } from "@/server/realtime";

/** SSE: avisa a tela quando conversas/mensagens do cliente mudam (só ids). */
export const Route = createFileRoute("/api/eventos")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await lerContexto();
        if (!ctx?.tenantId) return new Response("Não autorizado", { status: 401 });
        const tenantId = ctx.tenantId;
        let parar = () => {};
        const stream = new ReadableStream<Uint8Array>({
          async start(ctrl) {
            const enc = new TextEncoder();
            const enviar = (t: string) => {
              try {
                ctrl.enqueue(enc.encode(t));
              } catch {
                parar();
              }
            };
            enviar("retry: 3000\n\n");
            const sair = await assinar(tenantId, (e) =>
              enviar(`data: ${JSON.stringify({ tabela: e.tabela, conversa: e.conversa })}\n\n`),
            );
            // Mantém a conexão viva atrás de proxies.
            const ping = setInterval(() => enviar(": ping\n\n"), 25_000);
            parar = () => {
              sair();
              clearInterval(ping);
            };
            request.signal.addEventListener("abort", () => {
              parar();
              try {
                ctrl.close();
              } catch {
                /* já fechado */
              }
            });
          },
          cancel() {
            parar();
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
