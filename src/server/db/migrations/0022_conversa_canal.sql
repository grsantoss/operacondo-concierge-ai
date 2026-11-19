CREATE TYPE "public"."canal_tipo" AS ENUM('whatsapp', 'email');--> statement-breakpoint
CREATE TABLE "email_canais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"endereco" text NOT NULL,
	"status" "canal_status" DEFAULT 'desconectado' NOT NULL,
	"segredo_cifrado" text,
	"webhook_hash" text,
	"verificado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_canais_tenant_id_unique" UNIQUE("tenant_id"),
	CONSTRAINT "email_canais_endereco_unique" UNIQUE("endereco"),
	CONSTRAINT "email_canais_webhook_hash_unique" UNIQUE("webhook_hash"),
	CONSTRAINT "email_canais_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "email_canais_endereco" CHECK (endereco = lower(endereco) and endereco like '%_@_%')
);
--> statement-breakpoint
ALTER TABLE "conversas" ALTER COLUMN "canal_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conversas" ALTER COLUMN "phone_e164" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conversas" ADD COLUMN "canal" "canal_tipo" DEFAULT 'whatsapp' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversas" ADD COLUMN "email_canal_id" uuid;--> statement-breakpoint
ALTER TABLE "conversas" ADD COLUMN "endereco" text;--> statement-breakpoint
ALTER TABLE "mensagens" ADD COLUMN "assunto" text;--> statement-breakpoint
ALTER TABLE "mensagens" ADD COLUMN "message_id" text;--> statement-breakpoint
ALTER TABLE "mensagens" ADD COLUMN "in_reply_to" text;--> statement-breakpoint
ALTER TABLE "email_canais" ADD CONSTRAINT "email_canais_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_tenant_id_email_canal_id_email_canais_tenant_id_id_fk" FOREIGN KEY ("tenant_id","email_canal_id") REFERENCES "public"."email_canais"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Conversas existentes são de WhatsApp: o telefone vira o endereço.
UPDATE "conversas" SET "endereco" = "phone_e164";