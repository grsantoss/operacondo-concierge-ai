-- Canal de e-mail do cliente: mesma RLS e permissões de whatsapp_canais (0001_rls.sql).
ALTER TABLE email_canais ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY cliente ON email_canais TO oc_app USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());--> statement-breakpoint
CREATE POLICY plataforma ON email_canais TO oc_admin USING (true) WITH CHECK (true);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON email_canais TO oc_app, oc_admin;
