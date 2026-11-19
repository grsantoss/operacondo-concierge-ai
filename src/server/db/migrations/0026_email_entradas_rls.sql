-- Entradas de e-mail: só a plataforma (oc_admin: webhook e worker), como whatsapp_entradas.
ALTER TABLE email_entradas ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY plataforma ON email_entradas TO oc_admin USING (true) WITH CHECK (true);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON email_entradas TO oc_admin;
