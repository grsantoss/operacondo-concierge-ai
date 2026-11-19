ALTER TABLE "consentimentos" ALTER COLUMN "phone_e164" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "consentimentos" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "consentimentos" ADD CONSTRAINT "consentimentos_titular" CHECK (num_nonnulls(phone_e164, email) = 1);