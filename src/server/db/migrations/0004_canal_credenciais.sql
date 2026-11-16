ALTER TABLE "whatsapp_canais" ADD COLUMN "instance_id" text;--> statement-breakpoint
ALTER TABLE "whatsapp_canais" ADD COLUMN "credenciais_cifradas" text;--> statement-breakpoint
ALTER TABLE "whatsapp_canais" ADD COLUMN "verificado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "whatsapp_canais" ADD COLUMN "conectado_em" timestamp with time zone;