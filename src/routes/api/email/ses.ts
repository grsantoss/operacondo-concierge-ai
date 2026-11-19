import { createFileRoute } from "@tanstack/react-router";
import { receberWebhookSes } from "@/server/email-entrada/webhook";

export const Route = createFileRoute("/api/email/ses")({
  server: {
    handlers: {
      POST: ({ request }) => receberWebhookSes(request),
    },
  },
});
