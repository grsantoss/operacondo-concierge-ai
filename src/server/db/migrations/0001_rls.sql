-- Isolamento por cliente (RLS), permissões dos papéis e a view de uso mensal.
-- oc_app  : só enxerga linhas do cliente em app.tenant_id (SET LOCAL via withTenant).
-- oc_admin: enxerga tudo por política explícita (portal /admin e worker).
-- Tabela nova de cliente precisa entrar na lista abaixo; tests/rls.test.ts falha se faltar.

-- Cliente da transação atual. Sem SET LOCAL → NULL → nenhuma linha (falha fechada).
CREATE FUNCTION app_tenant_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;

DO $$
DECLARE
  t text;
  -- tabelas em que a aplicação lê e escreve
  rw text[] := ARRAY[
    'membros', 'whatsapp_canais', 'condominios', 'unidades', 'moradores', 'morador_contatos',
    'consentimentos', 'conversas', 'mensagens', 'demandas', 'demanda_eventos', 'demanda_anexos',
    'fornecedores', 'fornecedor_documentos', 'documentos', 'documento_trechos', 'agente_config',
    'llm_execucoes'];
  -- espelho do Stripe: o síndico só lê; quem escreve é o worker (oc_admin)
  ro text[] := ARRAY['assinaturas', 'faturas'];
BEGIN
  FOREACH t IN ARRAY rw || ro LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY cliente ON %I TO oc_app USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id())', t);
    EXECUTE format('CREATE POLICY plataforma ON %I TO oc_admin USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO oc_admin', t);
  END LOOP;
  FOREACH t IN ARRAY rw LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO oc_app', t);
  END LOOP;
  FOREACH t IN ARRAY ro LOOP
    EXECUTE format('GRANT SELECT ON %I TO oc_app', t);
  END LOOP;
END $$;

-- O próprio cliente: o síndico lê só o dele.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY cliente ON tenants TO oc_app USING (id = app_tenant_id());
CREATE POLICY plataforma ON tenants TO oc_admin USING (true) WITH CHECK (true);
GRANT SELECT ON tenants TO oc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants TO oc_admin;

-- Catálogo de planos: público para leitura.
GRANT SELECT ON planos TO oc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON planos TO oc_admin;

-- Eventos do Stripe: só o worker.
GRANT SELECT, INSERT, UPDATE, DELETE ON stripe_eventos TO oc_admin;

-- Better Auth: tabelas globais (sem cliente), acessadas só pela biblioteca de autenticação.
GRANT SELECT, INSERT, UPDATE, DELETE ON "user", session, account, verification TO oc_app, oc_admin;

-- Depois do login ainda não há cliente na sessão do banco, e membros tem RLS. Esta função
-- (dona: oc_owner, que não passa por RLS) devolve só os vínculos do próprio usuário.
CREATE FUNCTION membros_do_usuario(p_user_id text)
  RETURNS TABLE (tenant_id uuid, membro_id uuid, papel papel_membro)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$ SELECT m.tenant_id, m.id, m.papel FROM membros m WHERE m.user_id = p_user_id ORDER BY m.criado_em $$;
REVOKE ALL ON FUNCTION membros_do_usuario(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION membros_do_usuario(text) TO oc_app, oc_admin;

-- Uso do mês corrente (fuso de São Paulo) por cliente, para os limites do plano.
-- security_invoker: a view respeita a RLS de quem consulta.
-- Resposta da IA = mensagem de saída com autor 'ia' (unidade cobrada).
CREATE VIEW uso_mensal WITH (security_invoker = true) AS
WITH mes AS (
  SELECT date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo' AS inicio
)
SELECT
  t.id AS tenant_id,
  (SELECT inicio FROM mes) AS mes_inicio,
  (SELECT count(*) FROM condominios c WHERE c.tenant_id = t.id) AS condominios,
  (SELECT count(*) FROM moradores m
     WHERE m.tenant_id = t.id AND m.desativado_em IS NULL AND m.cadastro <> 'recusado') AS moradores,
  (SELECT count(*) FROM documentos d WHERE d.tenant_id = t.id) AS documentos,
  (SELECT count(*) FROM mensagens x
     WHERE x.tenant_id = t.id AND x.autor = 'ia' AND x.direcao = 'saida'
       AND x.criado_em >= (SELECT inicio FROM mes)) AS respostas_ia,
  (SELECT coalesce(sum(l.custo_usd), 0) FROM llm_execucoes l
     WHERE l.tenant_id = t.id AND l.criado_em >= (SELECT inicio FROM mes)) AS custo_ia_usd
FROM tenants t;
GRANT SELECT ON uso_mensal TO oc_app, oc_admin;
