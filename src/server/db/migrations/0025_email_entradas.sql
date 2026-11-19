CREATE TABLE "email_entradas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email_canal_id" uuid NOT NULL,
	"message_id" text NOT NULL,
	"s3_chave" text NOT NULL,
	"autenticacao" jsonb NOT NULL,
	"payload" jsonb NOT NULL,
	"original_path" text,
	"mensagem_id" uuid,
	"ignorado" text,
	"recebido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"processado_em" timestamp with time zone,
	CONSTRAINT "email_entradas_email_canal_id_message_id_unique" UNIQUE("email_canal_id","message_id")
);
--> statement-breakpoint
ALTER TABLE "email_canais" DROP CONSTRAINT "email_canais_webhook_hash_unique";--> statement-breakpoint
ALTER TABLE "email_entradas" ADD CONSTRAINT "email_entradas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_entradas" ADD CONSTRAINT "email_entradas_tenant_id_email_canal_id_email_canais_tenant_id_id_fk" FOREIGN KEY ("tenant_id","email_canal_id") REFERENCES "public"."email_canais"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_canais" DROP COLUMN "segredo_cifrado";--> statement-breakpoint
ALTER TABLE "email_canais" DROP COLUMN "webhook_hash";