ALTER TABLE "fornecedores" ADD COLUMN "contato_nome" text;--> statement-breakpoint
ALTER TABLE "fornecedores" ADD COLUMN "observacoes" text;--> statement-breakpoint
ALTER TABLE "fornecedores" ADD CONSTRAINT "fornecedores_tenant_id_cnpj_unique" UNIQUE("tenant_id","cnpj");