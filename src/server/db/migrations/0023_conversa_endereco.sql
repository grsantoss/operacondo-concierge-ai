ALTER TABLE "conversas" DROP CONSTRAINT "phone_e164_e164";--> statement-breakpoint
ALTER TABLE "conversas" ALTER COLUMN "endereco" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "conversas" DROP COLUMN "phone_e164";--> statement-breakpoint
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_canal" CHECK ((canal = 'whatsapp' and canal_id is not null and email_canal_id is null and endereco ~ '^\+[1-9][0-9]{7,14}$')
        or (canal = 'email' and email_canal_id is not null and canal_id is null and endereco = lower(endereco) and endereco like '%_@_%'));