-- Preparação do banco, feita UMA vez por quem administra o Postgres (superusuário no container;
-- usuário mestre no RDS/Cloud SQL/Azure). Depois disso, nada mais exige privilégio especial:
-- as migrations rodam como oc_owner.
--
--   psql "$URL_DO_ADMIN" -v dbname=concierge -v owner_pw=... -v app_pw=... -v admin_pw=... -f db/bootstrap.sql
--
-- Papéis:
--   oc_owner  dono das tabelas, roda as migrations (RLS não se aplica a ele: nunca usar na aplicação)
--   oc_app    aplicação; não é dono de nada e passa por RLS (só vê o cliente de app.tenant_id)
--   oc_admin  portal /admin e worker; vê todos os clientes por política explícita (sem BYPASSRLS,
--             que exige superusuário e não existe em alguns provedores gerenciados)

CREATE ROLE oc_owner LOGIN PASSWORD :'owner_pw';
CREATE ROLE oc_app   LOGIN PASSWORD :'app_pw';
CREATE ROLE oc_admin LOGIN PASSWORD :'admin_pw';

GRANT CONNECT, CREATE ON DATABASE :"dbname" TO oc_owner;
GRANT CONNECT ON DATABASE :"dbname" TO oc_app, oc_admin;

GRANT ALL ON SCHEMA public TO oc_owner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO oc_app, oc_admin;

-- Únicas extensões usadas (ambas disponíveis nos Postgres gerenciados).
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
