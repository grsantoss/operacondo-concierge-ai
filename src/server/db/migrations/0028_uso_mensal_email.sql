-- Resposta da IA (unidade cobrada) nos dois canais (#80): no WhatsApp, mensagem de saída com
-- autor 'ia'; no e-mail, a resposta vira rascunho para o síndico (quem envia é ele), então conta
-- cada execução do agente numa conversa de e-mail.
CREATE OR REPLACE VIEW uso_mensal WITH (security_invoker = true) AS
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
       AND x.criado_em >= (SELECT inicio FROM mes))
  + (SELECT count(*) FROM llm_execucoes l JOIN conversas cv ON cv.id = l.conversa_id
     WHERE l.tenant_id = t.id AND cv.canal = 'email'
       AND l.criado_em >= (SELECT inicio FROM mes)) AS respostas_ia,
  (SELECT coalesce(sum(l.custo_usd), 0) FROM llm_execucoes l
     WHERE l.tenant_id = t.id AND l.criado_em >= (SELECT inicio FROM mes)) AS custo_ia_usd
FROM tenants t;
