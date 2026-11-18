-- Planos decididos em 18/11/2026 (CLAUDE.md, "Cobrança"). Limites por condomínio da assinatura.
-- O seed de desenvolvimento não cria planos: esta migration é a fonte, em dev e em produção.
INSERT INTO "planos" (
  "id", "nome", "preco_mensal", "condominios_inclusos", "preco_condominio_adicional",
  "limite_condominios", "limite_moradores", "limite_documentos", "limite_respostas_ia_mes",
  "teto_custo_ia_mes", "usa_conselheiro", "vendavel", "ativo"
) VALUES
  ('trial', 'Trial', 0, 1, NULL, 1, 50, 5, 150, 15, false, false, true),
  ('essencial', 'Essencial', 197, 1, 97, 4, 300, 20, 1000, 90, false, true, true),
  ('profissional', 'Profissional', 547, 5, 97, 50, 300, 20, 1000, 90, true, true, true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- Planos do mock antigo: saem da venda (assinaturas antigas continuam apontando para eles).
UPDATE "planos" SET "ativo" = false, "vendavel" = false
WHERE "id" IN ('starter', 'pro', 'enterprise');
