import { createFileRoute } from "@tanstack/react-router";
import { receberWebhookZapi } from "@/server/whatsapp/webhook";

export const Route = createFileRoute("/api/whatsapp/zapi/$segredo")({
  server: {
    handlers: {
      POST: ({ request, params }) => receberWebhookZapi(params.segredo, request),
    },
  },
});
