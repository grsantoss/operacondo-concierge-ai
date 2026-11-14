CREATE TYPE "public"."assinatura_status" AS ENUM('trialing', 'active', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused');--> statement-breakpoint
CREATE TYPE "public"."autor_mensagem" AS ENUM('morador', 'ia', 'sindico', 'sistema');--> statement-breakpoint
CREATE TYPE "public"."cadastro" AS ENUM('pendente', 'aprovado', 'recusado');--> statement-breakpoint
CREATE TYPE "public"."canal_evento" AS ENUM('whatsapp', 'portal', 'portaria', 'ia', 'sistema');--> statement-breakpoint
CREATE TYPE "public"."canal_status" AS ENUM('conectado', 'desconectado');--> statement-breakpoint
CREATE TYPE "public"."categoria_demanda" AS ENUM('manutencao', 'seguranca', 'limpeza', 'administrativo');--> statement-breakpoint
CREATE TYPE "public"."colecao" AS ENUM('convencao', 'estatuto', 'regimento', 'ata', 'procedimento', 'comunicado', 'manual');--> statement-breakpoint
CREATE TYPE "public"."coluna_demanda" AS ENUM('novas', 'triagem', 'execucao', 'resolvidas');--> statement-breakpoint
CREATE TYPE "public"."condominio_tipo" AS ENUM('vertical', 'horizontal');--> statement-breakpoint
CREATE TYPE "public"."conversa_estado" AS ENUM('ia', 'aguardando_sindico', 'sindico', 'resolvida');--> statement-breakpoint
CREATE TYPE "public"."direcao" AS ENUM('entrada', 'saida');--> statement-breakpoint
CREATE TYPE "public"."documento_status" AS ENUM('enviado', 'processando', 'revisao', 'treinado', 'erro');--> statement-breakpoint
CREATE TYPE "public"."fatura_status" AS ENUM('draft', 'open', 'paid', 'void', 'uncollectible');--> statement-breakpoint
CREATE TYPE "public"."forma_cobranca" AS ENUM('cartao', 'boleto');--> statement-breakpoint
CREATE TYPE "public"."fornecedor_estado" AS ENUM('homologado', 'em_analise', 'renovacao', 'inativo');--> statement-breakpoint
CREATE TYPE "public"."intervalo" AS ENUM('mensal', 'anual');--> statement-breakpoint
CREATE TYPE "public"."metodo_pagamento" AS ENUM('cartao', 'boleto', 'pix');--> statement-breakpoint
CREATE TYPE "public"."morador_status" AS ENUM('residente', 'locatario', 'proprietario', 'inativo');--> statement-breakpoint
CREATE TYPE "public"."origem_texto" AS ENUM('docling', 'claude');--> statement-breakpoint
CREATE TYPE "public"."papel_membro" AS ENUM('sindico', 'conselho', 'admin');--> statement-breakpoint
CREATE TYPE "public"."prioridade" AS ENUM('normal', 'alta', 'critica');--> statement-breakpoint
CREATE TYPE "public"."suspensao" AS ENUM('nenhuma', 'parcial', 'integral');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('trial', 'ativo', 'inadimplente', 'suspenso', 'cancelado', 'excluido');--> statement-breakpoint
CREATE TYPE "public"."tipo_anexo" AS ENUM('image', 'pdf', 'video');--> statement-breakpoint
CREATE TYPE "public"."tipo_doc_fornecedor" AS ENUM('cnpj', 'contrato', 'certidao', 'apolice', 'art', 'outro');--> statement-breakpoint
CREATE TYPE "public"."tipo_mensagem" AS ENUM('texto', 'audio', 'imagem', 'documento');--> statement-breakpoint
CREATE TYPE "public"."tom" AS ENUM('formal', 'cordial', 'direto');--> statement-breakpoint
CREATE TYPE "public"."visibilidade" AS ENUM('interno', 'conselho', 'moradores', 'publico');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_provider" AS ENUM('zapi', 'meta');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agente_config" (
	"condominio_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tom" "tom" DEFAULT 'cordial' NOT NULL,
	"opcoes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"limite_aprovacao" numeric(10, 2),
	"horario_silencioso" text,
	"instrucoes" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assinaturas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plano_id" text NOT NULL,
	"stripe_subscription_id" text,
	"status" "assinatura_status" NOT NULL,
	"forma_cobranca" "forma_cobranca" NOT NULL,
	"intervalo" intervalo DEFAULT 'mensal' NOT NULL,
	"cartao_fingerprint" text,
	"periodo_inicio" timestamp with time zone,
	"periodo_fim" timestamp with time zone,
	"trial_fim" timestamp with time zone,
	"cancela_no_fim" boolean DEFAULT false NOT NULL,
	"cancelada_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assinaturas_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id"),
	CONSTRAINT "assinaturas_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "condominios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"tipo" "condominio_tipo" NOT NULL,
	"cidade" text,
	"uf" text,
	"unidades_total" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "condominios_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "consentimentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"phone_e164" text NOT NULL,
	"finalidade" text NOT NULL,
	"texto_versao" text NOT NULL,
	"aceito_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "phone_e164_e164" CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "conversas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"canal_id" uuid NOT NULL,
	"phone_e164" text NOT NULL,
	"condominio_id" uuid,
	"morador_id" uuid,
	"estado" "conversa_estado" DEFAULT 'ia' NOT NULL,
	"prioridade" "prioridade" DEFAULT 'normal' NOT NULL,
	"ultima_msg_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversas_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "phone_e164_e164" CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "demanda_anexos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"demanda_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"tipo" "tipo_anexo" NOT NULL,
	"storage_path" text NOT NULL,
	"tamanho_bytes" bigint,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demanda_eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"demanda_id" uuid NOT NULL,
	"ator" text NOT NULL,
	"acao" text NOT NULL,
	"detalhe" text,
	"canal" "canal_evento" DEFAULT 'sistema' NOT NULL,
	"em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demandas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"condominio_id" uuid NOT NULL,
	"unidade_id" uuid,
	"morador_id" uuid,
	"conversa_id" uuid,
	"titulo" text NOT NULL,
	"descricao" text,
	"local" text,
	"categoria" "categoria_demanda" NOT NULL,
	"prioridade" "prioridade" DEFAULT 'normal' NOT NULL,
	"coluna" "coluna_demanda" DEFAULT 'novas' NOT NULL,
	"sla_ate" timestamp with time zone,
	"responsavel_id" uuid,
	"fornecedor_id" uuid,
	"custo_estimado" numeric(10, 2),
	"custo_aprovado" numeric(10, 2),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "demandas_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "demandas_tenant_id_codigo_unique" UNIQUE("tenant_id","codigo")
);
--> statement-breakpoint
CREATE TABLE "documento_trechos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"documento_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"referencia" text,
	"ordem" integer NOT NULL,
	"texto" text NOT NULL,
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('portuguese', texto)) STORED,
	"embedding" vector(1024)
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"colecao" "colecao" NOT NULL,
	"visibilidade" "visibilidade" DEFAULT 'moradores' NOT NULL,
	"vigente_desde" date,
	"revoga_documento_id" uuid,
	"status" "documento_status" DEFAULT 'enviado' NOT NULL,
	"origem_texto" "origem_texto",
	"storage_path" text NOT NULL,
	"tamanho_bytes" bigint,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documentos_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "faturas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"assinatura_id" uuid,
	"stripe_invoice_id" text,
	"numero" text,
	"status" "fatura_status" NOT NULL,
	"valor_total" numeric(10, 2) NOT NULL,
	"valor_pago" numeric(10, 2) DEFAULT 0 NOT NULL,
	"valor_estornado" numeric(10, 2) DEFAULT 0 NOT NULL,
	"vencimento" date,
	"pago_em" timestamp with time zone,
	"metodo_pagamento" "metodo_pagamento",
	"url_fatura" text,
	"url_pdf" text,
	"nfse_numero" text,
	"nfse_emitida_em" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faturas_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id")
);
--> statement-breakpoint
CREATE TABLE "fornecedor_documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"fornecedor_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"tipo" "tipo_doc_fornecedor" NOT NULL,
	"valido_ate" date,
	"storage_path" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fornecedores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"categoria" text,
	"cnpj" text,
	"estado" "fornecedor_estado" DEFAULT 'em_analise' NOT NULL,
	"rating" numeric(2, 1),
	"contato" text,
	"email" text,
	"criterios_ok" text[] DEFAULT '{}'::text[] NOT NULL,
	"homologacao_valida_ate" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fornecedores_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "llm_execucoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conversa_id" uuid,
	"condominio_id" uuid,
	"modelo" text NOT NULL,
	"tokens_entrada" integer DEFAULT 0 NOT NULL,
	"tokens_saida" integer DEFAULT 0 NOT NULL,
	"tokens_cache" integer DEFAULT 0 NOT NULL,
	"custo_usd" numeric(10, 6) DEFAULT 0 NOT NULL,
	"latencia_ms" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"papel" "papel_membro" NOT NULL,
	"condominio_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membros_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "membros_tenant_id_user_id_unique" UNIQUE("tenant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "mensagens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conversa_id" uuid NOT NULL,
	"direcao" "direcao" NOT NULL,
	"autor" "autor_mensagem" NOT NULL,
	"tipo" "tipo_mensagem" DEFAULT 'texto' NOT NULL,
	"texto" text,
	"transcricao" text,
	"midia_path" text,
	"provider_msg_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mensagens_provider_msg_id_unique" UNIQUE("provider_msg_id")
);
--> statement-breakpoint
CREATE TABLE "morador_contatos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"morador_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"phone_e164" text NOT NULL,
	"principal" boolean DEFAULT true NOT NULL,
	CONSTRAINT "morador_contatos_condominio_id_phone_e164_unique" UNIQUE("condominio_id","phone_e164"),
	CONSTRAINT "phone_e164_e164" CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "moradores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"unidade_id" uuid,
	"nome" text NOT NULL,
	"status" "morador_status" DEFAULT 'residente' NOT NULL,
	"cadastro" "cadastro" DEFAULT 'pendente' NOT NULL,
	"cpf_hash" text,
	"cpf_final" text,
	"email" text,
	"pets" integer DEFAULT 0 NOT NULL,
	"desde" date,
	"desativado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moradores_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "planos" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"preco_mensal" numeric(10, 2) NOT NULL,
	"stripe_product_id" text,
	"limite_condominios" integer NOT NULL,
	"limite_moradores" integer NOT NULL,
	"limite_documentos" integer NOT NULL,
	"limite_respostas_ia_mes" integer NOT NULL,
	"teto_custo_ia_mes" numeric(10, 2) NOT NULL,
	"usa_conselheiro" boolean DEFAULT false NOT NULL,
	"vendavel" boolean DEFAULT true NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "stripe_eventos" (
	"event_id" text PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"recebido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"processado_em" timestamp with time zone,
	"erro" text,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"razao_social" text NOT NULL,
	"nome_fantasia" text NOT NULL,
	"cnpj" text,
	"email" text,
	"telefone" text,
	"cidade" text,
	"uf" text,
	"responsavel" text,
	"status" "tenant_status" DEFAULT 'trial' NOT NULL,
	"stripe_customer_id" text,
	"inadimplente_desde" date,
	"suspensao" "suspensao" DEFAULT 'nenhuma' NOT NULL,
	"exclusao_prevista_em" date,
	"excluido_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_cnpj_unique" UNIQUE("cnpj"),
	CONSTRAINT "tenants_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "unidades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"bloco" text,
	"andar" integer,
	"apto" text,
	"quadra" text,
	"casa" text,
	"vagas" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "unidades_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "unidades_condominio_id_bloco_apto_quadra_casa_unique" UNIQUE NULLS NOT DISTINCT("condominio_id","bloco","apto","quadra","casa")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_canais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"phone_e164" text NOT NULL,
	"provider" "whatsapp_provider" NOT NULL,
	"credenciais_ref" text,
	"status" "canal_status" DEFAULT 'desconectado' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_canais_tenant_id_unique" UNIQUE("tenant_id"),
	CONSTRAINT "whatsapp_canais_phone_e164_unique" UNIQUE("phone_e164"),
	CONSTRAINT "whatsapp_canais_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "phone_e164_e164" CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agente_config" ADD CONSTRAINT "agente_config_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agente_config" ADD CONSTRAINT "agente_config_tenant_id_condominio_id_condominios_tenant_id_id_fk" FOREIGN KEY ("tenant_id","condominio_id") REFERENCES "public"."condominios"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_plano_id_planos_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."planos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condominios" ADD CONSTRAINT "condominios_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consentimentos" ADD CONSTRAINT "consentimentos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_tenant_id_canal_id_whatsapp_canais_tenant_id_id_fk" FOREIGN KEY ("tenant_id","canal_id") REFERENCES "public"."whatsapp_canais"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_tenant_id_condominio_id_condominios_tenant_id_id_fk" FOREIGN KEY ("tenant_id","condominio_id") REFERENCES "public"."condominios"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_tenant_id_morador_id_moradores_tenant_id_id_fk" FOREIGN KEY ("tenant_id","morador_id") REFERENCES "public"."moradores"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demanda_anexos" ADD CONSTRAINT "demanda_anexos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demanda_anexos" ADD CONSTRAINT "demanda_anexos_tenant_id_demanda_id_demandas_tenant_id_id_fk" FOREIGN KEY ("tenant_id","demanda_id") REFERENCES "public"."demandas"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demanda_eventos" ADD CONSTRAINT "demanda_eventos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demanda_eventos" ADD CONSTRAINT "demanda_eventos_tenant_id_demanda_id_demandas_tenant_id_id_fk" FOREIGN KEY ("tenant_id","demanda_id") REFERENCES "public"."demandas"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandas" ADD CONSTRAINT "demandas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandas" ADD CONSTRAINT "demandas_tenant_id_condominio_id_condominios_tenant_id_id_fk" FOREIGN KEY ("tenant_id","condominio_id") REFERENCES "public"."condominios"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandas" ADD CONSTRAINT "demandas_tenant_id_unidade_id_unidades_tenant_id_id_fk" FOREIGN KEY ("tenant_id","unidade_id") REFERENCES "public"."unidades"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandas" ADD CONSTRAINT "demandas_tenant_id_morador_id_moradores_tenant_id_id_fk" FOREIGN KEY ("tenant_id","morador_id") REFERENCES "public"."moradores"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandas" ADD CONSTRAINT "demandas_tenant_id_conversa_id_conversas_tenant_id_id_fk" FOREIGN KEY ("tenant_id","conversa_id") REFERENCES "public"."conversas"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandas" ADD CONSTRAINT "demandas_tenant_id_responsavel_id_membros_tenant_id_id_fk" FOREIGN KEY ("tenant_id","responsavel_id") REFERENCES "public"."membros"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandas" ADD CONSTRAINT "demandas_tenant_id_fornecedor_id_fornecedores_tenant_id_id_fk" FOREIGN KEY ("tenant_id","fornecedor_id") REFERENCES "public"."fornecedores"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_trechos" ADD CONSTRAINT "documento_trechos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_trechos" ADD CONSTRAINT "documento_trechos_tenant_id_documento_id_documentos_tenant_id_id_fk" FOREIGN KEY ("tenant_id","documento_id") REFERENCES "public"."documentos"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_trechos" ADD CONSTRAINT "documento_trechos_tenant_id_condominio_id_condominios_tenant_id_id_fk" FOREIGN KEY ("tenant_id","condominio_id") REFERENCES "public"."condominios"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_tenant_id_condominio_id_condominios_tenant_id_id_fk" FOREIGN KEY ("tenant_id","condominio_id") REFERENCES "public"."condominios"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_tenant_id_revoga_documento_id_documentos_tenant_id_id_fk" FOREIGN KEY ("tenant_id","revoga_documento_id") REFERENCES "public"."documentos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_tenant_id_assinatura_id_assinaturas_tenant_id_id_fk" FOREIGN KEY ("tenant_id","assinatura_id") REFERENCES "public"."assinaturas"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fornecedor_documentos" ADD CONSTRAINT "fornecedor_documentos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fornecedor_documentos" ADD CONSTRAINT "fornecedor_documentos_tenant_id_fornecedor_id_fornecedores_tenant_id_id_fk" FOREIGN KEY ("tenant_id","fornecedor_id") REFERENCES "public"."fornecedores"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fornecedores" ADD CONSTRAINT "fornecedores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_execucoes" ADD CONSTRAINT "llm_execucoes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_execucoes" ADD CONSTRAINT "llm_execucoes_tenant_id_conversa_id_conversas_tenant_id_id_fk" FOREIGN KEY ("tenant_id","conversa_id") REFERENCES "public"."conversas"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_execucoes" ADD CONSTRAINT "llm_execucoes_tenant_id_condominio_id_condominios_tenant_id_id_fk" FOREIGN KEY ("tenant_id","condominio_id") REFERENCES "public"."condominios"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membros" ADD CONSTRAINT "membros_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membros" ADD CONSTRAINT "membros_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_tenant_id_conversa_id_conversas_tenant_id_id_fk" FOREIGN KEY ("tenant_id","conversa_id") REFERENCES "public"."conversas"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "morador_contatos" ADD CONSTRAINT "morador_contatos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "morador_contatos" ADD CONSTRAINT "morador_contatos_tenant_id_morador_id_moradores_tenant_id_id_fk" FOREIGN KEY ("tenant_id","morador_id") REFERENCES "public"."moradores"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "morador_contatos" ADD CONSTRAINT "morador_contatos_tenant_id_condominio_id_condominios_tenant_id_id_fk" FOREIGN KEY ("tenant_id","condominio_id") REFERENCES "public"."condominios"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moradores" ADD CONSTRAINT "moradores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moradores" ADD CONSTRAINT "moradores_tenant_id_condominio_id_condominios_tenant_id_id_fk" FOREIGN KEY ("tenant_id","condominio_id") REFERENCES "public"."condominios"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moradores" ADD CONSTRAINT "moradores_tenant_id_unidade_id_unidades_tenant_id_id_fk" FOREIGN KEY ("tenant_id","unidade_id") REFERENCES "public"."unidades"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_tenant_id_condominio_id_condominios_tenant_id_id_fk" FOREIGN KEY ("tenant_id","condominio_id") REFERENCES "public"."condominios"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_canais" ADD CONSTRAINT "whatsapp_canais_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assinaturas_cartao_fingerprint_index" ON "assinaturas" USING btree ("cartao_fingerprint");--> statement-breakpoint
CREATE INDEX "consentimentos_tenant_id_phone_e164_index" ON "consentimentos" USING btree ("tenant_id","phone_e164");--> statement-breakpoint
CREATE INDEX "conversas_tenant_id_ultima_msg_em_index" ON "conversas" USING btree ("tenant_id","ultima_msg_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "demanda_eventos_demanda_id_em_index" ON "demanda_eventos" USING btree ("demanda_id","em");--> statement-breakpoint
CREATE INDEX "demandas_tenant_id_coluna_index" ON "demandas" USING btree ("tenant_id","coluna");--> statement-breakpoint
CREATE INDEX "documento_trechos_tsv_index" ON "documento_trechos" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "documento_trechos_documento_id_ordem_index" ON "documento_trechos" USING btree ("documento_id","ordem");--> statement-breakpoint
CREATE INDEX "documentos_tenant_id_condominio_id_colecao_index" ON "documentos" USING btree ("tenant_id","condominio_id","colecao");--> statement-breakpoint
CREATE INDEX "faturas_tenant_id_vencimento_index" ON "faturas" USING btree ("tenant_id","vencimento");--> statement-breakpoint
CREATE INDEX "llm_execucoes_tenant_id_criado_em_index" ON "llm_execucoes" USING btree ("tenant_id","criado_em");--> statement-breakpoint
CREATE INDEX "membros_user_id_index" ON "membros" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mensagens_conversa_id_criado_em_index" ON "mensagens" USING btree ("conversa_id","criado_em");--> statement-breakpoint
CREATE INDEX "mensagens_tenant_id_autor_criado_em_index" ON "mensagens" USING btree ("tenant_id","autor","criado_em");--> statement-breakpoint
CREATE INDEX "morador_contatos_tenant_id_phone_e164_index" ON "morador_contatos" USING btree ("tenant_id","phone_e164");--> statement-breakpoint
CREATE INDEX "moradores_tenant_id_condominio_id_index" ON "moradores" USING btree ("tenant_id","condominio_id");