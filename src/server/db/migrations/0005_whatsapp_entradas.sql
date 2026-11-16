CREATE TABLE "whatsapp_entradas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"canal_id" uuid NOT NULL,
	"provider_msg_id" text NOT NULL,
	"telefone" text NOT NULL,
	"payload" jsonb NOT NULL,
	"recebido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"processado_em" timestamp with time zone,
	CONSTRAINT "whatsapp_entradas_canal_id_provider_msg_id_unique" UNIQUE("canal_id","provider_msg_id"),
	CONSTRAINT "telefone_e164" CHECK (telefone ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
ALTER TABLE "whatsapp_canais" ADD COLUMN "webhook_hash" text;--> statement-breakpoint
ALTER TABLE "whatsapp_entradas" ADD CONSTRAINT "whatsapp_entradas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_entradas" ADD CONSTRAINT "whatsapp_entradas_tenant_id_canal_id_whatsapp_canais_tenant_id_id_fk" FOREIGN KEY ("tenant_id","canal_id") REFERENCES "public"."whatsapp_canais"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "whatsapp_entradas_canal_id_telefone_processado_em_index" ON "whatsapp_entradas" USING btree ("canal_id","telefone","processado_em");--> statement-breakpoint
ALTER TABLE "whatsapp_canais" ADD CONSTRAINT "whatsapp_canais_webhook_hash_unique" UNIQUE("webhook_hash");