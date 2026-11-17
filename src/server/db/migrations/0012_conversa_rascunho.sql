CREATE TYPE "public"."avaliacao_rascunho" AS ENUM('aprovado', 'editado', 'reescrito');--> statement-breakpoint
ALTER TABLE "conversas" ADD COLUMN "rascunho" text;--> statement-breakpoint
ALTER TABLE "conversas" ADD COLUMN "rascunho_motivo" text;--> statement-breakpoint
ALTER TABLE "mensagens" ADD COLUMN "avaliacao_rascunho" "avaliacao_rascunho";