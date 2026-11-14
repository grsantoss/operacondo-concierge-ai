/**
 * Schema do banco (Drizzle). Regras que valem para todas as tabelas de cliente:
 * - toda linha tem `tenant_id`; o isolamento é feito por RLS (migration `rls`), não pelo código;
 * - chaves estrangeiras entre tabelas de cliente incluem o `tenant_id` (FK composta), porque a
 *   checagem de FK ignora RLS: sem isso, um cliente poderia apontar para o condomínio de outro.
 * Tabela nova de cliente: tenant_id + `unique(tenant_id, id)` + entrada na migration de RLS
 * (o teste `tests/rls.test.ts` falha se a RLS faltar).
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  customType,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ helpers */

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });
const ts = (name: string) => timestamp(name, { withTimezone: true });
const criadoEm = () => ts("criado_em").notNull().defaultNow();
const id = () => uuid("id").primaryKey().defaultRandom();
const tenantId = () =>
  uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" });
const dinheiro = (name: string) => numeric(name, { precision: 10, scale: 2, mode: "number" });
/** Telefone sempre em E.164: + seguido de 8 a 15 dígitos. */
const e164 = (col: string) => check(`${col}_e164`, sql.raw(`${col} ~ '^\\+[1-9][0-9]{7,14}$'`));

/* -------------------------------------------------------------------- enums */

export const tenantStatus = pgEnum("tenant_status", [
  "trial",
  "ativo",
  "inadimplente",
  "suspenso",
  "cancelado",
  "excluido",
]);
export const suspensao = pgEnum("suspensao", ["nenhuma", "parcial", "integral"]);
export const papelMembro = pgEnum("papel_membro", ["sindico", "conselho", "admin"]);
export const whatsappProvider = pgEnum("whatsapp_provider", ["zapi", "meta"]);
export const canalStatus = pgEnum("canal_status", ["conectado", "desconectado"]);
export const assinaturaStatus = pgEnum("assinatura_status", [
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "paused",
]);
export const formaCobranca = pgEnum("forma_cobranca", ["cartao", "boleto"]);
export const intervalo = pgEnum("intervalo", ["mensal", "anual"]);
export const faturaStatus = pgEnum("fatura_status", [
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
]);
export const metodoPagamento = pgEnum("metodo_pagamento", ["cartao", "boleto", "pix"]);
export const condominioTipo = pgEnum("condominio_tipo", ["vertical", "horizontal"]);
export const moradorStatus = pgEnum("morador_status", [
  "residente",
  "locatario",
  "proprietario",
  "inativo",
]);
export const cadastro = pgEnum("cadastro", ["pendente", "aprovado", "recusado"]);
export const conversaEstado = pgEnum("conversa_estado", [
  "ia",
  "aguardando_sindico",
  "sindico",
  "resolvida",
]);
export const prioridade = pgEnum("prioridade", ["normal", "alta", "critica"]);
export const direcao = pgEnum("direcao", ["entrada", "saida"]);
export const autorMensagem = pgEnum("autor_mensagem", ["morador", "ia", "sindico", "sistema"]);
export const tipoMensagem = pgEnum("tipo_mensagem", ["texto", "audio", "imagem", "documento"]);
export const categoriaDemanda = pgEnum("categoria_demanda", [
  "manutencao",
  "seguranca",
  "limpeza",
  "administrativo",
]);
export const colunaDemanda = pgEnum("coluna_demanda", [
  "novas",
  "triagem",
  "execucao",
  "resolvidas",
]);
export const canalEvento = pgEnum("canal_evento", [
  "whatsapp",
  "portal",
  "portaria",
  "ia",
  "sistema",
]);
export const tipoAnexo = pgEnum("tipo_anexo", ["image", "pdf", "video"]);
export const fornecedorEstado = pgEnum("fornecedor_estado", [
  "homologado",
  "em_analise",
  "renovacao",
  "inativo",
]);
export const tipoDocFornecedor = pgEnum("tipo_doc_fornecedor", [
  "cnpj",
  "contrato",
  "certidao",
  "apolice",
  "art",
  "outro",
]);
export const colecao = pgEnum("colecao", [
  "convencao",
  "estatuto",
  "regimento",
  "ata",
  "procedimento",
  "comunicado",
  "manual",
]);
export const visibilidade = pgEnum("visibilidade", ["interno", "conselho", "moradores", "publico"]);
export const documentoStatus = pgEnum("documento_status", [
  "enviado",
  "processando",
  "revisao",
  "treinado",
  "erro",
]);
export const origemTexto = pgEnum("origem_texto", ["docling", "claude"]);
export const tom = pgEnum("tom", ["formal", "cordial", "direto"]);

/* ------------------------------------------------- Better Auth (sem cliente) */
// Nomes de tabela e campos são os padrões do Better Auth; colunas em snake_case no banco.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** "admin" = Admin Master da plataforma (/admin). Demais usuários: "user". */
  role: text("role").notNull().default("user"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: ts("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: ts("access_token_expires_at"),
  refreshTokenExpiresAt: ts("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/* ------------------------------------------------------ Clientes e acesso */

export const tenants = pgTable("tenants", {
  id: id(),
  razaoSocial: text("razao_social").notNull(),
  nomeFantasia: text("nome_fantasia").notNull(),
  /** Só dígitos. Um trial por CNPJ. */
  cnpj: text("cnpj").unique(),
  email: text("email"),
  telefone: text("telefone"),
  cidade: text("cidade"),
  uf: text("uf"),
  responsavel: text("responsavel"),
  /** Derivado da assinatura e da fatura (webhook e job diário). Não editar à mão. */
  status: tenantStatus("status").notNull().default("trial"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  inadimplenteDesde: date("inadimplente_desde"),
  suspensao: suspensao("suspensao").notNull().default("nenhuma"),
  exclusaoPrevistaEm: date("exclusao_prevista_em"),
  excluidoEm: ts("excluido_em"),
  criadoEm: criadoEm(),
});

export const membros = pgTable(
  "membros",
  {
    id: id(),
    tenantId: tenantId(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    papel: papelMembro("papel").notNull(),
    /** Vazio = todos os condomínios do cliente. */
    condominioIds: uuid("condominio_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    criadoEm: criadoEm(),
  },
  (t) => [unique().on(t.tenantId, t.id), unique().on(t.tenantId, t.userId), index().on(t.userId)],
);

export const whatsappCanais = pgTable(
  "whatsapp_canais",
  {
    id: id(),
    tenantId: tenantId().unique(),
    phoneE164: text("phone_e164").notNull().unique(),
    provider: whatsappProvider("provider").notNull(),
    /** Referência ao segredo (nome no cofre/variável), nunca o token em texto. */
    credenciaisRef: text("credenciais_ref"),
    status: canalStatus("status").notNull().default("desconectado"),
    criadoEm: criadoEm(),
  },
  (t) => [unique().on(t.tenantId, t.id), e164("phone_e164")],
);

/* ------------------------------------------------------- Cobrança (Stripe) */

export const planos = pgTable("planos", {
  /** trial | starter | pro | enterprise. Preços no Stripe: lookup_key `{id}_mensal` / `{id}_anual`. */
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  /** Só para exibir; o valor cobrado é o do Stripe. Anual = 10 × mensal. */
  precoMensal: dinheiro("preco_mensal").notNull(),
  stripeProductId: text("stripe_product_id"),
  limiteCondominios: integer("limite_condominios").notNull(),
  limiteMoradores: integer("limite_moradores").notNull(),
  limiteDocumentos: integer("limite_documentos").notNull(),
  limiteRespostasIaMes: integer("limite_respostas_ia_mes").notNull(),
  tetoCustoIaMes: dinheiro("teto_custo_ia_mes").notNull(),
  usaConselheiro: boolean("usa_conselheiro").notNull().default(false),
  vendavel: boolean("vendavel").notNull().default(true),
  ativo: boolean("ativo").notNull().default(true),
});

export const assinaturas = pgTable(
  "assinaturas",
  {
    id: id(),
    tenantId: tenantId(),
    planoId: text("plano_id")
      .notNull()
      .references(() => planos.id),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    status: assinaturaStatus("status").notNull(),
    formaCobranca: formaCobranca("forma_cobranca").notNull(),
    intervalo: intervalo("intervalo").notNull().default("mensal"),
    cartaoFingerprint: text("cartao_fingerprint"),
    periodoInicio: ts("periodo_inicio"),
    periodoFim: ts("periodo_fim"),
    trialFim: ts("trial_fim"),
    cancelaNoFim: boolean("cancela_no_fim").notNull().default(false),
    canceladaEm: ts("cancelada_em"),
    criadoEm: criadoEm(),
    atualizadoEm: ts("atualizado_em").notNull().defaultNow(),
  },
  (t) => [unique().on(t.tenantId, t.id), index().on(t.cartaoFingerprint)],
);

export const faturas = pgTable(
  "faturas",
  {
    id: id(),
    tenantId: tenantId(),
    /** Vazio = cobrança avulsa. */
    assinaturaId: uuid("assinatura_id"),
    stripeInvoiceId: text("stripe_invoice_id").unique(),
    numero: text("numero"),
    /** "Vencida" = open com vencimento passado. */
    status: faturaStatus("status").notNull(),
    valorTotal: dinheiro("valor_total").notNull(),
    valorPago: dinheiro("valor_pago").notNull().default(0),
    valorEstornado: dinheiro("valor_estornado").notNull().default(0),
    vencimento: date("vencimento"),
    pagoEm: ts("pago_em"),
    metodoPagamento: metodoPagamento("metodo_pagamento"),
    urlFatura: text("url_fatura"),
    urlPdf: text("url_pdf"),
    nfseNumero: text("nfse_numero"),
    nfseEmitidaEm: date("nfse_emitida_em"),
    criadoEm: criadoEm(),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.assinaturaId],
      foreignColumns: [assinaturas.tenantId, assinaturas.id],
    }),
    index().on(t.tenantId, t.vencimento),
  ],
);

/** Todo evento recebido do Stripe (idempotência e auditoria). Sem RLS: só oc_admin acessa. */
export const stripeEventos = pgTable("stripe_eventos", {
  eventId: text("event_id").primaryKey(),
  tipo: text("tipo").notNull(),
  recebidoEm: ts("recebido_em").notNull().defaultNow(),
  processadoEm: ts("processado_em"),
  erro: text("erro"),
  payload: jsonb("payload").notNull(),
});

/* ---------------------------------------------------- Condomínios e pessoas */

export const condominios = pgTable(
  "condominios",
  {
    id: id(),
    tenantId: tenantId(),
    nome: text("nome").notNull(),
    tipo: condominioTipo("tipo").notNull(),
    cidade: text("cidade"),
    uf: text("uf"),
    unidadesTotal: integer("unidades_total"),
    criadoEm: criadoEm(),
  },
  (t) => [unique().on(t.tenantId, t.id)],
);

const doCondominio = (t: { tenantId: AnyPgColumn; condominioId: AnyPgColumn }) =>
  foreignKey({
    columns: [t.tenantId, t.condominioId],
    foreignColumns: [condominios.tenantId, condominios.id],
  }).onDelete("cascade");

export const unidades = pgTable(
  "unidades",
  {
    id: id(),
    tenantId: tenantId(),
    condominioId: uuid("condominio_id").notNull(),
    /** Condomínio vertical. */
    bloco: text("bloco"),
    andar: integer("andar"),
    apto: text("apto"),
    /** Condomínio horizontal. */
    quadra: text("quadra"),
    casa: text("casa"),
    vagas: integer("vagas").notNull().default(0),
  },
  (t) => [
    unique().on(t.tenantId, t.id),
    unique().on(t.condominioId, t.bloco, t.apto, t.quadra, t.casa).nullsNotDistinct(),
    doCondominio(t),
  ],
);

export const moradores = pgTable(
  "moradores",
  {
    id: id(),
    tenantId: tenantId(),
    condominioId: uuid("condominio_id").notNull(),
    /** Opcional enquanto o cadastro estiver pendente. */
    unidadeId: uuid("unidade_id"),
    nome: text("nome").notNull(),
    status: moradorStatus("status").notNull().default("residente"),
    /** pendente = criado pelo agente no 1º contato; aprovado pelo síndico ou pela importação CSV. */
    cadastro: cadastro("cadastro").notNull().default("pendente"),
    /** LGPD: CPF nunca em texto aberto. */
    cpfHash: text("cpf_hash"),
    cpfFinal: text("cpf_final"),
    email: text("email"),
    pets: integer("pets").notNull().default(0),
    desde: date("desde"),
    desativadoEm: ts("desativado_em"),
    criadoEm: criadoEm(),
  },
  (t) => [
    unique().on(t.tenantId, t.id),
    doCondominio(t),
    foreignKey({
      columns: [t.tenantId, t.unidadeId],
      foreignColumns: [unidades.tenantId, unidades.id],
    }),
    index().on(t.tenantId, t.condominioId),
  ],
);

export const moradorContatos = pgTable(
  "morador_contatos",
  {
    id: id(),
    tenantId: tenantId(),
    moradorId: uuid("morador_id").notNull(),
    condominioId: uuid("condominio_id").notNull(),
    phoneE164: text("phone_e164").notNull(),
    principal: boolean("principal").notNull().default(true),
  },
  (t) => [
    unique().on(t.condominioId, t.phoneE164),
    foreignKey({
      columns: [t.tenantId, t.moradorId],
      foreignColumns: [moradores.tenantId, moradores.id],
    }).onDelete("cascade"),
    doCondominio(t),
    index().on(t.tenantId, t.phoneE164),
    e164("phone_e164"),
  ],
);

export const consentimentos = pgTable(
  "consentimentos",
  {
    id: id(),
    tenantId: tenantId(),
    phoneE164: text("phone_e164").notNull(),
    finalidade: text("finalidade").notNull(),
    textoVersao: text("texto_versao").notNull(),
    aceitoEm: ts("aceito_em").notNull().defaultNow(),
  },
  (t) => [index().on(t.tenantId, t.phoneE164), e164("phone_e164")],
);

/* ------------------------------------------------------ Atendimento WhatsApp */

export const conversas = pgTable(
  "conversas",
  {
    id: id(),
    tenantId: tenantId(),
    canalId: uuid("canal_id").notNull(),
    phoneE164: text("phone_e164").notNull(),
    /** Vazio enquanto o roteamento não definir o condomínio. */
    condominioId: uuid("condominio_id"),
    moradorId: uuid("morador_id"),
    estado: conversaEstado("estado").notNull().default("ia"),
    /** Mesma escala das demandas; assume a maior entre a triagem e as demandas abertas. */
    prioridade: prioridade("prioridade").notNull().default("normal"),
    ultimaMsgEm: ts("ultima_msg_em").notNull().defaultNow(),
    criadoEm: criadoEm(),
  },
  (t) => [
    unique().on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.canalId],
      foreignColumns: [whatsappCanais.tenantId, whatsappCanais.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.condominioId],
      foreignColumns: [condominios.tenantId, condominios.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.moradorId],
      foreignColumns: [moradores.tenantId, moradores.id],
    }),
    index().on(t.tenantId, t.ultimaMsgEm.desc()),
    e164("phone_e164"),
  ],
);

export const mensagens = pgTable(
  "mensagens",
  {
    id: id(),
    tenantId: tenantId(),
    conversaId: uuid("conversa_id").notNull(),
    direcao: direcao("direcao").notNull(),
    autor: autorMensagem("autor").notNull(),
    tipo: tipoMensagem("tipo").notNull().default("texto"),
    texto: text("texto"),
    transcricao: text("transcricao"),
    /** Caminho no S3: {tenant_id}/{condominio_id}/{colecao}/… */
    midiaPath: text("midia_path"),
    /** Evita gravar duas vezes a mesma mensagem do provedor. */
    providerMsgId: text("provider_msg_id").unique(),
    criadoEm: criadoEm(),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.conversaId],
      foreignColumns: [conversas.tenantId, conversas.id],
    }).onDelete("cascade"),
    index().on(t.conversaId, t.criadoEm),
    index().on(t.tenantId, t.autor, t.criadoEm),
  ],
);

/* ------------------------------------------------- Demandas e fornecedores */

export const fornecedores = pgTable(
  "fornecedores",
  {
    id: id(),
    tenantId: tenantId(),
    nome: text("nome").notNull(),
    categoria: text("categoria"),
    cnpj: text("cnpj"),
    estado: fornecedorEstado("estado").notNull().default("em_analise"),
    rating: numeric("rating", { precision: 2, scale: 1, mode: "number" }),
    contato: text("contato"),
    email: text("email"),
    /** Critérios de homologação já atendidos (ids de CRITERIOS_HOMOLOGACAO). */
    criteriosOk: text("criterios_ok")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    homologacaoValidaAte: date("homologacao_valida_ate"),
    criadoEm: criadoEm(),
  },
  (t) => [unique().on(t.tenantId, t.id)],
);

export const fornecedorDocumentos = pgTable(
  "fornecedor_documentos",
  {
    id: id(),
    tenantId: tenantId(),
    fornecedorId: uuid("fornecedor_id").notNull(),
    nome: text("nome").notNull(),
    tipo: tipoDocFornecedor("tipo").notNull(),
    validoAte: date("valido_ate"),
    storagePath: text("storage_path"),
    criadoEm: criadoEm(),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.fornecedorId],
      foreignColumns: [fornecedores.tenantId, fornecedores.id],
    }).onDelete("cascade"),
  ],
);

export const demandas = pgTable(
  "demandas",
  {
    id: id(),
    tenantId: tenantId(),
    /** D-2401: sequencial por cliente. */
    codigo: text("codigo").notNull(),
    condominioId: uuid("condominio_id").notNull(),
    unidadeId: uuid("unidade_id"),
    moradorId: uuid("morador_id"),
    conversaId: uuid("conversa_id"),
    titulo: text("titulo").notNull(),
    descricao: text("descricao"),
    local: text("local"),
    categoria: categoriaDemanda("categoria").notNull(),
    prioridade: prioridade("prioridade").notNull().default("normal"),
    coluna: colunaDemanda("coluna").notNull().default("novas"),
    slaAte: ts("sla_ate"),
    responsavelId: uuid("responsavel_id"),
    fornecedorId: uuid("fornecedor_id"),
    custoEstimado: dinheiro("custo_estimado"),
    custoAprovado: dinheiro("custo_aprovado"),
    criadoEm: criadoEm(),
    atualizadoEm: ts("atualizado_em").notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.tenantId, t.id),
    unique().on(t.tenantId, t.codigo),
    doCondominio(t),
    foreignKey({
      columns: [t.tenantId, t.unidadeId],
      foreignColumns: [unidades.tenantId, unidades.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.moradorId],
      foreignColumns: [moradores.tenantId, moradores.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.conversaId],
      foreignColumns: [conversas.tenantId, conversas.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.responsavelId],
      foreignColumns: [membros.tenantId, membros.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.fornecedorId],
      foreignColumns: [fornecedores.tenantId, fornecedores.id],
    }),
    index().on(t.tenantId, t.coluna),
  ],
);

const daDemanda = (t: { tenantId: AnyPgColumn; demandaId: AnyPgColumn }) =>
  foreignKey({
    columns: [t.tenantId, t.demandaId],
    foreignColumns: [demandas.tenantId, demandas.id],
  }).onDelete("cascade");

export const demandaEventos = pgTable(
  "demanda_eventos",
  {
    id: id(),
    tenantId: tenantId(),
    demandaId: uuid("demanda_id").notNull(),
    ator: text("ator").notNull(),
    acao: text("acao").notNull(),
    detalhe: text("detalhe"),
    canal: canalEvento("canal").notNull().default("sistema"),
    em: ts("em").notNull().defaultNow(),
  },
  (t) => [daDemanda(t), index().on(t.demandaId, t.em)],
);

export const demandaAnexos = pgTable(
  "demanda_anexos",
  {
    id: id(),
    tenantId: tenantId(),
    demandaId: uuid("demanda_id").notNull(),
    nome: text("nome").notNull(),
    tipo: tipoAnexo("tipo").notNull(),
    storagePath: text("storage_path").notNull(),
    tamanhoBytes: bigint("tamanho_bytes", { mode: "number" }),
    criadoEm: criadoEm(),
  },
  (t) => [daDemanda(t)],
);

/* ---------------------------------------------------- Base de conhecimento */

export const documentos = pgTable(
  "documentos",
  {
    id: id(),
    tenantId: tenantId(),
    condominioId: uuid("condominio_id").notNull(),
    titulo: text("titulo").notNull(),
    colecao: colecao("colecao").notNull(),
    visibilidade: visibilidade("visibilidade").notNull().default("moradores"),
    vigenteDesde: date("vigente_desde"),
    /** A ata que altera uma regra aponta para o documento que ela revoga. */
    revogaDocumentoId: uuid("revoga_documento_id"),
    status: documentoStatus("status").notNull().default("enviado"),
    origemTexto: origemTexto("origem_texto"),
    storagePath: text("storage_path").notNull(),
    tamanhoBytes: bigint("tamanho_bytes", { mode: "number" }),
    criadoEm: criadoEm(),
  },
  (t) => [
    unique().on(t.tenantId, t.id),
    doCondominio(t),
    foreignKey({
      columns: [t.tenantId, t.revogaDocumentoId],
      foreignColumns: [t.tenantId, t.id],
    }),
    index().on(t.tenantId, t.condominioId, t.colecao),
  ],
);

export const documentoTrechos = pgTable(
  "documento_trechos",
  {
    id: id(),
    tenantId: tenantId(),
    documentoId: uuid("documento_id").notNull(),
    condominioId: uuid("condominio_id").notNull(),
    /** Ex.: "Art. 12 §2". */
    referencia: text("referencia"),
    ordem: integer("ordem").notNull(),
    texto: text("texto").notNull(),
    tsv: tsvector("tsv").generatedAlwaysAs(sql`to_tsvector('portuguese', texto)`),
    /** Fase 2 (Voyage). */
    embedding: vector("embedding", { dimensions: 1024 }),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.documentoId],
      foreignColumns: [documentos.tenantId, documentos.id],
    }).onDelete("cascade"),
    doCondominio(t),
    index().using("gin", t.tsv),
    index().on(t.documentoId, t.ordem),
  ],
);

/* ------------------------------------------------------------ Agente e uso */

export const agenteConfig = pgTable(
  "agente_config",
  {
    condominioId: uuid("condominio_id").primaryKey(),
    tenantId: tenantId(),
    tom: tom("tom").notNull().default("cordial"),
    /** Reservas, orçamentos, escalonamento… */
    opcoes: jsonb("opcoes").notNull().default({}),
    /** Orçamento acima disto vai para aprovação do síndico. */
    limiteAprovacao: dinheiro("limite_aprovacao"),
    horarioSilencioso: text("horario_silencioso"),
    instrucoes: text("instrucoes"),
    atualizadoEm: ts("atualizado_em").notNull().defaultNow(),
  },
  (t) => [doCondominio(t)],
);

/** Cada chamada ao modelo: uso, custo e limite do plano (fonte da cobrança, não o Langfuse). */
export const llmExecucoes = pgTable(
  "llm_execucoes",
  {
    id: id(),
    tenantId: tenantId(),
    conversaId: uuid("conversa_id"),
    condominioId: uuid("condominio_id"),
    modelo: text("modelo").notNull(),
    tokensEntrada: integer("tokens_entrada").notNull().default(0),
    tokensSaida: integer("tokens_saida").notNull().default(0),
    tokensCache: integer("tokens_cache").notNull().default(0),
    custoUsd: numeric("custo_usd", { precision: 10, scale: 6, mode: "number" })
      .notNull()
      .default(0),
    latenciaMs: integer("latencia_ms"),
    criadoEm: criadoEm(),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.conversaId],
      foreignColumns: [conversas.tenantId, conversas.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.condominioId],
      foreignColumns: [condominios.tenantId, condominios.id],
    }),
    index().on(t.tenantId, t.criadoEm),
  ],
);
