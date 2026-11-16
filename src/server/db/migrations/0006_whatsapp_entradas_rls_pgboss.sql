-- Entradas do webhook: só a plataforma (oc_admin: webhook e worker) lê e escreve.
-- RLS ligada mesmo sem acesso do oc_app, para seguir a regra das tabelas de cliente.
ALTER TABLE whatsapp_entradas ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY plataforma ON whatsapp_entradas TO oc_admin USING (true) WITH CHECK (true);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_entradas TO oc_admin;
--> statement-breakpoint
-- Fila (pg-boss): schema próprio criado aqui (sem superusuário); o oc_admin cria as tabelas da
-- fila nele no primeiro start (createSchema: false) e é dono delas.
CREATE SCHEMA IF NOT EXISTS pgboss;
--> statement-breakpoint
GRANT USAGE, CREATE ON SCHEMA pgboss TO oc_admin;
