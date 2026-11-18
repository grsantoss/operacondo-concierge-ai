ALTER TABLE "planos" ADD COLUMN "condominios_inclusos" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "planos" ADD COLUMN "preco_condominio_adicional" numeric(10, 2);