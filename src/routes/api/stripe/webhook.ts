import { createFileRoute } from "@tanstack/react-router";
import { receberWebhookStripe } from "@/server/billing/webhook";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => receberWebhookStripe(request),
    },
  },
});
