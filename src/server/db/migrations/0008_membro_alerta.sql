ALTER TABLE "membros" ADD COLUMN "alerta_e164" text;--> statement-breakpoint
ALTER TABLE "membros" ADD CONSTRAINT "alerta_e164_e164" CHECK (alerta_e164 ~ '^\+[1-9][0-9]{7,14}$');