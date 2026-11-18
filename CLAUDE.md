# OperaCondo Concierge

Concierge com IA para síndicos (moradores ou profissionais, com um ou vários condomínios).
O agente atende moradores pelo WhatsApp: responde com base em convenção, estatuto, regimento
interno e atas; classifica demandas por urgência; abre demandas; faz o cadastro do morador
(com aprovação do síndico); passa a conversa para o síndico quando precisa.

Responda sempre em português do Brasil, com acentuação correta.

## Estado atual (16/11/2026)

- **Fase 0 (fundação) feita** (issues #2–#7, `v0.1.0`); releases `v0.2.0` e `v0.3.0` com a Fase 1: Postgres + schema + RLS + login.
- **Fase 1 concluída** (issues #8–#14): telas passam dos mocks de `src/data/*.ts` para o banco.
  Já leem e gravam no banco: moradores e condomínios (#8), demandas com anexos (#9),
  fornecedores com documentos (#10), a base de conhecimento (#11; arquivos no S3, status
  "enviado" até a leitura da Fase 3), a configuração do agente por condomínio (#12;
  `agente_config`, ajustes em `opcoes` validados por zod com padrões) e o portal `/admin` (#13;
  `src/lib/admin.functions.ts` com `dbAdmin()`/`oc_admin` e `exigirAdmin()`; Stripe na Fase 6).
- **Fase 2 (WhatsApp, #15–#20) e Fase 3 (#21, leitura dos documentos) concluídas**, uma issue
  por PR. **Fase 4 (agente v1, #22–#27) concluída** (`v0.6.0`). **Fase 5 (#28, cadastro com
  aprovação)** fecha a primeira rodada. **Fase 6 (cobrança Stripe, #29–#35) em andamento**;
  depois vem a Fase 6.5 (canal de e-mail, #78–#83). Testes reais (instância Z-API, transcrição,
  Claude, pagamento) ficam para depois de todas as issues.
- Rodar localmente: `cp .env.example .env` → `bun run db:reset` (sobe containers, migrations e
  seed) → `bun run dev` (e `bun run worker` para a fila; `bun run docling:up` para ler documentos). Login: `sindico@operacondo.local` (cliente Aurora) ou
  `admin@operacondo.local` (Admin Master), senha `SEED_SENHA` (padrão `operacondo123`).
- Stack: TanStack Start + React 19 + Tailwind 4 + shadcn/ui (`new-york`, `slate`), Nitro com
  `preset: "node-server"` (`bun run build && bun start` → `.output/server/index.mjs`).
- Lovable removido e desconectado (PR #1).
- Baseline conhecida: `tsc` limpo; `bun run lint` já tinha ~18 mil erros (Prettier) antes das
  mudanças. Todas as telas cabem em 390px sem rolagem horizontal (#14); manter assim.

## Telas e o que elas viram no produto

| Rota | Papel |
|---|---|
| `/app/agente` | Caixa de conversas do WhatsApp: urgência, estado (IA atendendo / Aguardando síndico / Síndico no controle / Resolvido), assumir conversa |
| `/app/base` e `/app/base/enviar` | Base de conhecimento: coleções + visibilidade (`interno/conselho/moradores/publico`) |
| `/app/configuracoes` | Config do agente por condomínio (tom, autonomia, escalonamento, limite R$, Z-API/Meta) |
| `/app/demandas` | Kanban (novas → triagem → execução → resolvidas) |
| `/app/moradores` | Moradores por condomínio (vertical/horizontal), importação CSV |
| `/admin/*` | Portal da plataforma: clientes (síndicos), planos, faturas |

Urgência: escala única `priority` em `src/lib/urgencia.ts` (`URGENCIA`, `maiorPrioridade`); a
temperatura (cold/warm/hot) saiu de todas as telas (#14).

## Decisões de produto (13/11/2026)

- **Urgência = `priority` (Crítica / Alta / Normal)** em demandas **e** conversas (mesma escala;
  a conversa assume a maior entre a triagem dela e as demandas abertas). Sai `temp`/`temperature`.
  Cores: Crítica → destructive, Alta → atenção, Normal → neutro.
- **Morador desconhecido:** sem integração com sistema externo, o Concierge aprende os números.
  No 1º contato o agente faz a triagem (condomínio da lista do síndico, unidade, nome, vínculo,
  aceite LGPD) e **salva o número na hora** como `moradores.cadastro = pendente`; nas próximas
  vezes já reconhece. Pendente pode: regras com visibilidade `publico` e abrir demanda. Só depois
  da aprovação do síndico: demandas próprias, regras `moradores`, dados da unidade. Importação CSV
  entra como aprovado. Tela (#28): cartão "Cadastros pelo WhatsApp esperando aprovação" em
  `/app/moradores` (`CadastrosPendentes`) e selo no menu; `listarPendentes`/`decidirCadastro` em
  `moradores.functions.ts`, lógica em `src/server/moradores.ts` (`decidirCadastroTx`). Aprovar
  sem unidade ligada exige o endereço; recusar vira `recusado` e mantém o número (o agente segue
  só com regras públicas). Pendentes e recusados ficam fora da lista de moradores e não ocupam
  unidade vaga.
- **Aprovação do síndico = o que não tiver base documental.** Achou trecho (convenção, estatuto,
  regimento, ata) → responde e cita. Não achou → `aguardando_sindico`, com rascunho marcado
  "sem base documental" para o síndico aprovar/editar. O controle "Autonomia da IA (%)" já foi
  trocado por um texto que explica essa regra (`app.configuracoes.tsx`). Abrir demanda é
  automático; orçamento acima de `limite_aprovacao` vai para aprovação. Fase 2: resposta do
  síndico vira entrada da base.

## Decisões de arquitetura

- **Sem LangChain/LangGraph.** Um agente só, com ~9 ferramentas, usando o SDK `@anthropic-ai/sdk`
  (Tool Runner). Sem vários agentes conversando entre si.
- **Modelos:** Claude Haiku 5.5 atende; Claude Opus 5.5 como conselheiro (advisor tool) nos casos
  ambíguos. Confirmar o pareamento Haiku 5.5 → Opus 5.5 na API antes de fixar.
- **WhatsApp:** **um número por síndico/cliente** para todos os condomínios dele. Z-API primeiro.
  Credenciais em `whatsapp_canais` (`instance_id` + `credenciais_cifradas`, AES-256-GCM em
  `src/server/cripto.ts`, chave `CREDENCIAIS_CHAVE`); cliente da Z-API em
  `src/server/whatsapp/zapi.ts` (`ZAPI_URL` troca a base em teste). Conexão pelo componente
  `ConexaoWhatsApp` (onboarding e Integrações). Rotas da Z-API ainda não testadas contra
  instância real: entra no teste de ponta a ponta, junto com banco, onboarding e pagamento.
  Entrada: `POST /api/whatsapp/zapi/{segredo}` (`src/server/whatsapp/webhook.ts`; segredo cifrado
  nas credenciais, `webhook_hash` no canal, registrado na Z-API ao verificar, com `APP_URL` https)
  → `whatsapp_entradas` (dedupe por `canal_id + provider_msg_id`; só oc_admin) → fila `mensagem`
  (pg-boss em `src/server/queue`, schema `pgboss` criado pela migration, política `stately`,
  `singletonKey` canal:telefone, 8 s de espera) → worker `src/server/worker.ts` →
  `src/server/pipeline/processar.ts` → `pipeline/roteamento.ts` (telefone → condomínio; menu
  numerado para vários ou desconhecido; grava `conversas`/`mensagens`; sem agente, conversa com
  condomínio fica `aguardando_sindico`). Envio: `src/server/whatsapp/send.ts`
  (`enviarNaConversa`, grava a saída). Falha no envio → rollback e nova tentativa da fila.
  Tempo real: triggers da migration 0007 fazem `pg_notify('eventos', {tenant, tabela, conversa})`
  (só ids) em `conversas`, `mensagens` e `demandas` → `src/server/realtime` (um LISTEN por
  processo) → SSE `GET /api/eventos` (filtra pelo cliente da sessão) → `useConversasAoVivo()`
  invalida as queries. Tela: `src/lib/conversas.functions.ts` + `src/data/conversas.ts`.
  Urgência fixa: `src/server/pipeline/regras-urgencia.ts` (gás, incêndio, elevador → crítica;
  vazamento → alta), detectada no roteamento → `conversas.prioridade` sobe (nunca desce) → fila
  `alerta` (singleton conversa:regra por 30 min) → `pipeline/alerta.ts` envia ao
  `membros.alerta_e164` de síndicos/admins do condomínio (sem condomínio definido: todos).
  Mídia: o roteamento devolve as mensagens com mídia → fila `midia` (5 tentativas; a URL da
  Z-API expira) → `pipeline/midia.ts` baixa para o S3 (`{tenant}/{condominio|sem-condominio}/
  whatsapp/{conversa}/{mensagem}.ext`, `mensagens.midia_path`) e transcreve áudio por
  `src/server/whatsapp/transcricao.ts` (`TRANSCRICAO_PROVEDOR` openai|deepgram; vazio = sem
  transcrição) → `mensagens.transcricao` → regras de urgência. UPDATE em `mensagens` também
  notifica a tela (migration 0009).
  O número identifica o cliente; o telefone do remetente identifica o condomínio:
  1 condomínio → segue; vários → pergunta qual; desconhecido → lista os condomínios do síndico,
  pergunta a unidade e cria cadastro pendente. Enquanto o condomínio não estiver definido, o agente
  não responde nada específico de condomínio.
- **Banco: Postgres puro (sem Supabase)** + pgvector. Isolamento por linha: toda tabela tem
  `tenant_id`, RLS filtra por `current_setting('app.tenant_id')` (`SET LOCAL` por transação). A
  aplicação conecta com um usuário **sem privilégios e que não é dono das tabelas** (dono e
  superusuário ignoram RLS). Nada de separação de clientes por pasta; só os arquivos usam o caminho
  `{tenant_id}/{condominio_id}/{colecao}/…`.
- **Backend:** Drizzle (ORM + migrations), Better Auth, pg-boss (fila, reenvio, agendamento,
  espera de 5–10 s para agrupar mensagens), LISTEN/NOTIFY + SSE para tempo real, S3 para
  arquivos, Voyage para embeddings.
- **Containers (Docker Compose):** `web` (telas + API + webhooks), `worker` (mesma imagem, consome
  a fila), `docling` (docling-serve), `postgres` (pgvector/pgvector:pg17), `s3` (SeaweedFS em dev), e o Langfuse
  auto-hospedado (`langfuse-web`, `langfuse-worker`, `clickhouse`, `redis`; reaproveita o S3).
  **Provedor do Postgres de produção: decisão do dono do projeto.** O código deve rodar igual em
  container e em Postgres gerenciado (RDS, Cloud SQL, Azure), então:
  - conexão só por variáveis (com `sslmode=require` em produção): `DATABASE_URL` (oc_app),
    `DATABASE_URL_ADMIN` (oc_admin: portal `/admin`, worker, seed) e `DATABASE_URL_MIGRATIONS`
    (oc_owner, só migrations);
  - preparação única do banco em `db/bootstrap.sql` (papéis + extensões), rodada por quem
    administra o Postgres; no container, roda sozinha na criação do volume;
  - migrations não exigem superusuário; extensões usadas: só `vector` e `pgcrypto` (ambas
    disponíveis nos gerenciados);
  - papéis: `oc_owner` (dono das tabelas, roda migrations), `oc_app` (aplicação, sujeito a RLS),
    `oc_admin` (portal admin; vê todos os clientes por **política explícita** `plataforma`, não
    por `BYPASSRLS`, que exige superusuário e falta em alguns gerenciados). Nada depende de
    acesso ao sistema de arquivos do banco;
  - pg-boss usa um schema próprio no mesmo banco; backup é responsabilidade do provedor
    (gerenciado) ou de um job de `pg_dump` (container).
- **RAG em duas fases:** (1) com o condomínio definido, convenção/estatuto/regimento inteiros no
  prompt com cache e citações; (2) quando as atas crescerem, busca híbrida (`tsvector` português +
  pgvector) com trechos cortados **por artigo/cláusula**. Prevalência: Convenção > Estatuto >
  Regimento > Ata mais recente que altere a regra. Sempre citar o artigo; sem trecho → "não
  encontrei" + encaminhar ao síndico.
- **Arquivos:** só pela API S3 (bucket `S3_BUCKET`; `src/server/arquivos.ts`, que cria o bucket na
  primeira gravação e gera links temporários). Em dev, SeaweedFS no Docker Compose (a MinIO
  parou de publicar imagens Docker em 2025); em produção, S3/R2 ou outro compatível.
- **Ingestão/OCR:** Docling interno (privacidade/LGPD, estrutura, previsibilidade). Páginas com
  baixa qualidade de OCR vão para o Claude (leitura de imagem). `.doc` antigo não é suportado.
  Fluxo: `enviarDocumentos` → fila `ingestao` → `src/server/ingest/index.ts` (TXT/MD direto;
  PDF/DOCX/imagem por `ingest/docling.ts`, `DOCLING_URL`, Markdown por página) →
  `paginaRuim` (heurística) → `ingest/fallback.ts` (Claude Haiku 5.5, `INGESTAO_MODELO`; só as
  páginas ruins, recortadas com pdf-lib, lotes de 10; uso em `llm_execucoes`) →
  `ingest/trechos.ts` (um trecho por artigo/cláusula com o capítulo como contexto; sem artigos,
  por título e tamanho) → `documento_trechos`. Status: `treinado`; `revisao` (páginas ilegíveis
  ou sem `ANTHROPIC_API_KEY`); `erro` (motivo em `documentos.leitura_aviso`, a fila tenta de novo).
  Embeddings (Voyage) ficam para a busca vetorial (#39, Fase 8).
- **Agente (núcleo, #22):** ligado por `ANTHROPIC_API_KEY` (`iaConfigurada()` em
  `src/server/llm.ts`, que também calcula o custo). Com IA, a conversa com condomínio definido fica
  em `ia` e o roteamento devolve `agente` → fila `agente` (stately por conversa, 2 novas
  tentativas; na última, vai para o síndico) → `src/server/agent/run.ts` `responder`.
  `agent/contexto.ts`: documentos `treinado`/`revisao` do condomínio visíveis ao morador (aprovado:
  `publico` + `moradores`; senão só `publico`), em ordem de prevalência, até ~250 mil caracteres;
  histórico de 30 mensagens. `agent/prompt.ts`: um bloco `document` por arquivo, um bloco de texto
  por trecho, citações ligadas e `cache_control` no último documento. Resposta começa com
  `[SEM_BASE]` (ou recusa/corte) → `aguardando_sindico` + `AVISO_SINDICO`; senão envia com a fonte
  ("📄 Regimento Interno, Art. 12", das citações) e a assinatura de `agente_config`. Resposta é
  descartada se o síndico assumiu ou chegou mensagem nova durante a chamada. Áudio: o agente roda
  depois da fila `midia`. Uso em `llm_execucoes` com `conversa_id` (soma das rodadas).
- **Ferramentas do agente (#23):** `src/server/agent/tools.ts`, Tool Runner do SDK
  (`client.beta.messages.toolRunner` + `betaZodTool`; o runner usa o beta
  `message-threads`, então só a 1ª chamada leva `tools`), até 6 rodadas. Cliente, condomínio,
  morador e telefone vêm do contexto (closure), nunca da entrada do modelo. `buscar_regras`
  (tsvector português, só visibilidade do morador, devolve `search_result` citável);
  `definir_condominio` (troca e responde de novo com os documentos do novo); `identificar_morador`;
  `registrar_cadastro` (sempre `pendente`, exige `aceite_lgpd: true`, grava contato,
  `consentimentos` e `moradores.unidade_informada`; `acharUnidade` liga à unidade se for
  inequívoca); `abrir_demanda` (código por `proximoCodigoDemanda`, prazo `SLA_HORAS`; custo acima
  de `limite_aprovacao` → coluna `triagem` + evento "Aguarda aprovação"); `minhas_demandas` e
  `atualizar_demanda` (só cadastro aprovado, só as próprias); `escalar_sindico` (o texto do
  modelo vai ao morador e a conversa vira `aguardando_sindico`). Demandas abertas da conversa
  entram no contexto para não abrir de novo.
- **Rascunho para o síndico (#24):** ao ir para o síndico, o agente grava
  `conversas.rascunho` (texto depois de `[SEM_BASE]`) e `conversas.rascunho_motivo` ("Sem base
  documental", motivo do `escalar_sindico`, falha ou recusa da IA). `/app/agente` mostra o cartão
  com "Aprovar e enviar" e "Editar". Ao responder, `avaliarRascunho()` grava a nota em
  `mensagens.avaliacao_rascunho` (`aprovado | editado | reescrito`) e o rascunho é apagado;
  resolver também apaga. A nota vai para o Langfuse na #26.
- **Observabilidade (#26):** `src/server/observability/index.ts` (`iniciarObservabilidade` no
  `src/server.ts` e no worker). Tudo opcional por variável. Langfuse: `NodeSDK` +
  `LangfuseSpanProcessor` (SDK v6 do Langfuse, servidor v4) com `mask` = `mascararDado` (CPF,
  telefone e segredo do webhook; UUID fica). O agente cria um rastro por resposta
  (`propagateAttributes` com `sessionId` = conversa; observação `agent`, uma `generation` por
  rodada com tokens e custo, e cada ferramenta como `tool`); os spans automáticos do SDK da
  Anthropic ficam desligados no agente (`openTelemetry: { traces: false, propagation: false }`)
  para não duplicar. `llm_execucoes.trace_id` liga a cobrança ao rastro; a nota do rascunho vai
  como score `rascunho` (`registrarNota`). Na v4 a leitura é por `/api/public/v2/observations`
  (o `/traces` não existe em modo events_only). Sentry: só erros (`enableOpenTelemetrySetup:
  false`, `dataCollection` sem usuário, cookies, cabeçalhos, corpo e query), `beforeSend`
  mascarado; falhas de job no worker (`comErros`) e do SSR (`capturarErro`). Navegador:
  `src/lib/sentry-navegador.ts` (`VITE_SENTRY_DSN`). `src/server/**` não pode ser importado no
  navegador (import-protection do TanStack Start): código comum fica em `src/lib`.
  Langfuse em dev: `bun run langfuse:up` (perfil `observabilidade`; banco `langfuse` no Postgres
  e bucket `langfuse` no S3 do projeto, por `scripts/langfuse-preparar.ts`).
- **Avaliação (#27):** `bun run evals [filtro…]` (`src/server/evals/run.ts`) cria um cliente
  temporário com o condomínio fictício "Edifício Jacarandá" (`evals/documentos/*.md`, com ata que
  altera o regimento e um procedimento `interno` com segredos), manda cada caso de
  `evals/perguntas.jsonl` pelo caminho real (entrada → roteamento → agente; Claude de verdade,
  Z-API falsa) e confere `espera`: `resultado` (`resposta | sindico | demanda`), `fonte` (trecho
  da linha "📄"), `contem`/`nao_contem`. Apaga o cliente no fim; sai com código 1 se algum caso
  falhar. Com Langfuse, os casos viram o dataset `concierge-perguntas` (id do item =
  `concierge-perguntas-{id}`) e cada execução um experimento com uma nota por critério + `passou`
  (na v4, experimentos ficam em `events_core`, não em `dataset_runs`). Precisa de
  `ANTHROPIC_API_KEY` (custa centavos por rodada); ainda não rodou contra o Claude real.
- **Mascaramento (#25):** `src/lib/mascarar.ts`. `mascarar()` troca CPF (formatado ou 11
  dígitos com DV válido) e telefone por `[CPF]`/`[telefone]` em toda mensagem da conversa antes
  de ir ao Claude; `mascararCpf()` nos trechos de documentos (telefone de portaria/zelador
  publicado pelo síndico continua). Usar as mesmas funções no Langfuse e no Sentry (#26). Áudio
  para transcrição e páginas para o fallback de OCR vão sem máscara (não há texto a mascarar).
  Áudio do WhatsApp precisa de transcrição externa (Whisper/Deepgram); fotos vão direto ao Claude.
- **Urgência:** regras fixas (gás, incêndio, alguém preso no elevador, vazamento) alertam o síndico
  sem depender da IA.
- **Observabilidade: Langfuse (IA) + Sentry (erros), instrumentados com OpenTelemetry** (feito na #26, ver acima).
  - Langfuse auto-hospedado: rastro de cada conversa (mensagem, trechos achados, ferramentas,
    resposta, tokens, custo por cliente/condomínio), datasets para `evals/` e notas de qualidade
    vindas do síndico (rascunho aprovado sem edição / editado / reescrito). Dados ficam no Brasil.
  - Sentry: erros de frontend e backend, alertas. Remover CPF e telefone dos eventos.
  - Mascarar CPF e telefone antes de qualquer envio (função de mascaramento do Langfuse,
    scrubbing do Sentry).
  - OpenTelemetry desde o início para trocar/somar Datadog depois só por configuração. Datadog fica
    para quando houver várias máquinas, plantão ou SLA com cliente.
  - `llm_execucoes` continua sendo a fonte de uso e cobrança (não depender da ferramenta externa).
  - Indicadores: % resolvido sem síndico, % sem base documental, % rascunho aprovado sem edição,
    tempo até 1ª resposta, tempo até o síndico ver uma Crítica, custo por conversa e condomínio.
- **Cobrança: Stripe (conta brasileira, BRL).** Detalhes na seção "Cobrança" abaixo.
- **Segurança das ferramentas:** toda ferramenta recebe `tenant_id`/`condominio_id` do contexto da
  conversa, **nunca do modelo**. A IA cadastra morador só como `pendente`; quem aprova é o síndico.

## Estrutura planejada do backend

```
src/server/
├── db/            # schema Drizzle, migrations, withTenant(tenantId, fn)
├── auth/          # Better Auth
├── queue/         # pg-boss: "mensagem", "ingestao", "alerta"
├── realtime/      # LISTEN/NOTIFY → SSE /api/eventos
├── whatsapp/      # webhook.ts (valida, deduplica por provider_msg_id, enfileira, 200), send.ts
├── pipeline/      # processar, normalizar (áudio/imagem), roteamento, urgencia
├── agent/         # run.ts, contexto.ts, prompts/skills/*.md, tools/*, guardrails.ts
├── ingest/        # docling.ts, fallback.ts (Claude), trechos.ts (corte por artigo + embeddings)
├── billing/       # stripe.ts (cliente), webhook.ts, sync.ts, checkout.ts, portal.ts, limites.ts
├── observability/ # OpenTelemetry → Langfuse, Sentry, gravação em llm_execucoes
└── evals/perguntas.jsonl
scripts/stripe-seed.ts  # cria/atualiza produtos e preços no Stripe por lookup_key (idempotente)
```

Ferramentas do agente: `buscar_regras`, `definir_condominio`, `identificar_morador`,
`registrar_cadastro`, `abrir_demanda`, `atualizar_demanda`, `minhas_demandas`, `escalar_sindico`
(`reservar_area` na fase 2).

Ordem de execução: (1) Postgres + schema + RLS + auth, trocar os mocks; (2) webhook Z-API gravando
mensagens ao vivo em `/app/agente`, sem IA; (3) agente v1; (4) cadastro com aprovação;
(5) cobrança Stripe (webhook, espelho no banco, Checkout/Portal, limites do plano) — antes do
primeiro cliente pagante; (6) atas com busca vetorial, conselheiro Opus, uso por cliente no
`/admin`. Langfuse + Sentry entram junto com o passo (3).

Tabelas principais (23; detalhes em https://claude.ai/artifact/YS5d6hpjQLmg8XKQ4PH1DM):
`tenants`, `condominios`, `membros`, `whatsapp_canais`, `unidades`,
`moradores` (com `cadastro` pendente/aprovado/recusado), `morador_contatos`, `consentimentos`, `conversas`,
`mensagens`, `demandas`, `demanda_eventos`, `demanda_anexos`, `fornecedores`,
`fornecedor_documentos`, `documentos`, `documento_trechos`, `agente_config`, `llm_execucoes`,
`planos`, `assinaturas`, `faturas`, `stripe_eventos`. Uso mensal é uma view (`uso_mensal`), não tabela.

## Cobrança (Stripe)

**O Stripe é a fonte da verdade do dinheiro; o banco é um espelho** atualizado só por webhook.
Nenhum dado de cartão passa pela aplicação (Checkout e Portal hospedados pelo Stripe).

Meios de pagamento (conta Stripe brasileira, BRL): **cartão** com cobrança automática recorrente e
**boleto** via fatura (`collection_method = send_invoice`). Pix: a documentação do Stripe é
contraditória sobre Pix recorrente para conta brasileira. Decidido em 18/11/2026 (#45): Pix
recorrente fica para depois; Pix só nas faturas enviadas por e-mail (boleto e avulsa), e só se o
Admin Master ligar em `/admin/financeiro` (`plataforma_config.pix_ativo`, desligado por padrão;
`billing/checkout.ts` `metodosFatura`). Ativar o Pix na conta Stripe antes de ligar.

Banco:
- `planos` (linhas criadas pela migration `0015`, não pelo seed): `trial | essencial |
  profissional`, + `stripe_product_id`, `ativo`, `vendavel` (o `trial` não é vendável),
  `condominios_inclusos`, `preco_condominio_adicional`, `limite_condominios` (máximo com os
  adicionais) e limites **por condomínio da assinatura** (`limite_moradores`,
  `limite_documentos`, `limite_respostas_ia_mes`, `teto_custo_ia_mes`), `usa_conselheiro`.
  A conta Stripe é dividida com o OperaCondo Insights: produtos `concierge_{item}` com
  `metadata.app = operacondo-concierge`, preços pelos `lookup_key` `concierge_{item}_mensal` /
  `concierge_{item}_anual`, nunca por `price_id` fixo no código. Catálogo em
  `src/server/billing/catalogo.ts`; cliente em `billing/stripe.ts` (SDK `stripe` 23.1.0 sem `^`,
  API `2026-10-28.endive`).
- `tenants`: + `stripe_customer_id` (único), `cnpj` (único; vai para o Stripe como `tax_id`
  `br_cnpj`), `inadimplente_desde`, `suspensao` (`nenhuma | parcial | integral`),
  `exclusao_prevista_em`, `excluido_em`. `tenants.status` (`trial | ativo | inadimplente |
  suspenso | cancelado | excluido`) é **derivado** da assinatura e da fatura pelo webhook e pelo
  job diário, não editado à mão.
- `assinaturas` (nova): `tenant_id`, `plano_id`, `stripe_subscription_id` (único), `status` (os do
  Stripe: `trialing, active, past_due, unpaid, canceled, incomplete, incomplete_expired, paused`),
  `forma_cobranca` (`cartao | boleto`), `periodo_inicio/fim`, `trial_fim`, `cancela_no_fim`,
  `cancelada_em`.
- `faturas`: `stripe_invoice_id` (único), `assinatura_id`, `numero`, `status` (os do Stripe:
  `draft, open, paid, void, uncollectible`; "vencida" = `open` com vencimento passado; estorno vira
  `valor_estornado`), `valor_total`, `valor_pago`, `vencimento`, `pago_em`, `metodo_pagamento`,
  `url_fatura` (hosted invoice), `url_pdf`, `nfse_numero`, `nfse_emitida_em`. Os mocks atuais
  (`past_due`, `refunded`) mudam.
- `assinaturas`: + `intervalo` (`mensal | anual`), `cartao_fingerprint` (antiabuso do trial).
- `stripe_eventos` (nova, sem RLS, só `oc_admin`): `event_id` (PK), `tipo`, `recebido_em`,
  `processado_em`, `erro`, `payload`. Garante idempotência e auditoria.
- RLS: o síndico lê `assinaturas` e `faturas` do próprio cliente; só o worker (`oc_admin`) escreve.

Webhook `POST /api/stripe/webhook` (feito na #30: `billing/webhook.ts` → fila `stripe`, política `stately` → `billing/sync.ts`
`processarEventoStripe`; `assinaturas.quantidade_condominios` = quantidade do item do plano; cliente Stripe
sem `tenants.stripe_customer_id` é ignorado, pois a conta é dividida com o Insights; `derivarCliente` calcula
`tenants.status` e `inadimplente_desde`, e o job diário da #35 aplica `suspensao`): corpo cru + verificação de assinatura com
`STRIPE_WEBHOOK_SECRET` → `INSERT stripe_eventos ON CONFLICT DO NOTHING` → 200 → fila pg-boss
`stripe`. O worker **busca o objeto atual na API do Stripe** (eventos chegam fora de ordem) e faz
upsert. Eventos: `checkout.session.completed`, `customer.subscription.created|updated|deleted|
trial_will_end`, `invoice.finalized|paid|payment_failed|payment_action_required|voided|
marked_uncollectible`, `charge.refunded`, `customer.updated`.

Fluxos:
- **Autoatendimento (canal principal, SaaS):** página pública `/planos` (mensal/anual) →
  `/cadastro` (conta Better Auth + dados do cliente, CNPJ único) → Stripe Checkout
  (`mode: subscription`, trial de 7 dias, **cartão exigido no trial**) → webhook
  `checkout.session.completed` ativa o cliente → `/onboarding` (inclui conectar o WhatsApp).
  Antiabuso: um trial por CNPJ, por número de WhatsApp e por cartão (fingerprint do cartão no
  Stripe).
  Feito na #31: `src/lib/cobranca.functions.ts` (`listarPlanosPublicos`, `criarConta` com CNPJ
  validado e `inserirCliente` de `src/server/clientes.ts`, `abrirCheckout`, `confirmarCheckout`)
  e telas `/planos`, `/cadastro` e `/assinar`. Cliente sem nenhuma assinatura
  (`getSessao().assinaturaPendente`) é mandado do `/app` para `/assinar`; a volta do Checkout
  (`/assinar?sessao=cs_…`) espelha na hora por `concluirCheckout` e segue para `/onboarding`.
  Antiabuso em `billing/trial.ts` + tabela `trial_usos` (hash de `tipo:valor`, sem FK, só
  oc_admin, sobrevive à exclusão): CNPJ repetido → Checkout sem trial; cartão ou WhatsApp
  repetido (no espelho da assinatura e ao salvar o canal) → `trial_end: now` no Stripe. Quem
  repete pode assinar, só sem os dias grátis.
- **Admin Master** (feito na #32: `lib/admin-cobranca.functions.ts`, `components/admin/CobrancaAdmin.tsx`,
  peças comuns com o autoatendimento em `billing/checkout.ts`; cada ação já chama o espelho, e o
  webhook confirma; `criarCliente` não cria mais assinatura no espelho: em seguida o admin chama
  `assinarCliente`, e se falhar a conta fica sem assinatura e o síndico cai em `/assinar`)
  (`/admin/usuarios/novo`): cria Customer + Subscription com trial; cartão → envia
  link do Checkout (`mode: subscription`); boleto → assinatura `send_invoice` com
  `days_until_due`. Ações no detalhe do cliente: trocar plano (com proration), cobrança avulsa
  (invoice item + invoice), reenviar fatura, marcar paga fora do Stripe (`paid_out_of_band`),
  estornar (total), anular, cancelar (fim do período ou agora). `StripeSection` deixa de ter campos de chave: mostra só modo (teste/produção),
  conta conectada e último webhook recebido.
- **Síndico** (`/app/configuracoes?aba=plano`, aba "Plano e cobrança", feita na #33:
  `components/app/PlanoCobranca.tsx`, `meuPlano`/`abrirPortal` em `cobranca.functions.ts`; limites
  efetivos em `billing/limites.ts` `assinaturaAtual`/`calcularLimites`: trial = plano `trial`;
  senão limite × max(quantidade, inclusos); portal padrão do Stripe já configurado na conta:
  cancela no fim do período, sem troca de plano): plano, uso x limites, próxima
  fatura, histórico (do banco) e botão "Gerenciar pagamento" → sessão do **Customer Portal**
  (trocar cartão, baixar faturas, cancelar conforme configuração do portal).
- **Limites do plano** (feito na #34: `billing/limites.ts`, `exigirLimite` em criar/reativar
  morador e enviar documento; o `registrar_cadastro` do agente não é bloqueado; condomínio ainda
  não tem tela de cadastro, então o limite de condomínios só aparece na aba; corte da IA no início
  de `agent/run.ts` por `iaNoLimite`, com `USD_BRL` para o teto; faixa `AvisoUso` no `AppShell`;
  sem assinatura = sem limite) (`billing/limites.ts`, lendo `uso_mensal`): moradores e condomínios
  bloqueiam o cadastro acima do limite. A unidade cobrada é **resposta da IA** (cada vez que o
  agente responde), não mensagem recebida; zera no mês do calendário, inclusive no plano anual.
  Aviso em 80%. **Em 100%, nenhuma chamada ao modelo**: só as regras fixas de urgência repassam ao
  síndico; as demais mensagens recebem resposta automática fixa ("seu síndico recebeu sua
  mensagem") e entram no painel como `aguardando_sindico`, com oferta de upgrade ao síndico.
  Teto técnico extra por cliente: custo em `llm_execucoes` no mês (protege contra conversas
  longas).
- **Trial (7 dias, reduzido):** durante `trialing` valem os limites do plano interno `trial`
  (não vendável), não os do plano escolhido: 1 condomínio, 50 moradores, 5 documentos na base,
  150 respostas da IA, só Haiku (sem conselheiro Opus). Números ajustáveis na tabela `planos`.
- **Planos e preços (18/11/2026):** Essencial R$ 197/mês (1 condomínio, até 4 com adicionais) e
  Profissional R$ 547/mês (5 condomínios, até 50; conselheiro Opus na Fase 8); condomínio
  adicional R$ 97/mês nos dois. Limites por condomínio: 1.000 respostas da IA/mês (WhatsApp +
  e-mail somados), 300 moradores, 20 documentos, teto técnico de custo de IA R$ 90 (R$ 0,09 por
  resposta da cota). No Stripe, um preço **escalonado (graduated)** por plano e intervalo, com a
  **quantidade = número de condomínios**: 1º degrau com valor fixo para os inclusos, 2º degrau
  com o adicional por condomínio. Cadastrar condomínio ajusta a quantidade (cobrança
  proporcional). Sem plano Escritório: carteiras grandes usam o Profissional com adicionais ou
  proposta pelo Admin Master.
- **WhatsApp é contratado pelo cliente** (Z-API na validação; API oficial da Meta na conta do
  cliente quando a #65 entrar). Se o cliente quiser o nosso número, paga o adicional
  **WhatsApp gerenciado** (R$ 119/mês por número, repasse da Z-API + taxas;
  `concierge_whatsapp_gerenciado_{mensal|anual}`).
- **Plano anual: paga 10, leva 12.** Cada plano tem dois preços no Stripe
  (`concierge_{plano}_mensal` e `concierge_{plano}_anual`, anual = 10 × mensal, intervalo de 1 ano). Anual pode ser cartão ou boleto
  único. Cancelamento do anual vale no fim do período, sem reembolso proporcional.
- **Inadimplência** (contada a partir do vencimento da fatura não paga, guardada em
  `tenants.inadimplente_desde`; job diário do pg-boss aplica as fases):
  - D+1 a D+7: tudo funciona, aviso no painel e e-mail.
  - D+7: **suspensão parcial** — painel só leitura; agente sem IA, responde mensagem fixa e só
    repassa urgências (regras fixas).
  - D+10: **suspensão integral (congelado)** — painel bloqueado, só a tela de pagamento abre;
    agente desligado, apenas resposta automática fixa "atendimento indisponível" (sem IA).
    Pagar a fatura em aberto reativa tudo na hora (via `invoice.paid`).
  - D+20 e D+27: e-mail avisando a data da exclusão.
  - D+30: **exclusão automática da conta** — cancela a assinatura no Stripe, desconecta o
    WhatsApp, apaga moradores, conversas, mensagens, demandas, documentos e arquivos do S3.
    **Mantém** faturas e dados fiscais (obrigação contábil) e um registro mínimo do cliente
    anonimizado. Backups expiram no ciclo normal (constar na política de privacidade).
  - No Stripe: retentativas do cartão dentro de 10 dias e, ao fim, marcar a assinatura como
    `unpaid` (não cancelar), para que pagar a fatura reative.
- **NFS-e manual por enquanto:** em `/admin/financeiro`, faturas pagas mostram "nota pendente";
  o admin registra número e data da nota (`faturas.nfse_numero`, `nfse_emitida_em`).

Configuração: só variáveis de ambiente — `STRIPE_SECRET_KEY` (preferir *restricted key*),
`STRIPE_WEBHOOK_SECRET`, versão da API fixada no cliente. Chaves de teste em dev/homologação,
produção só no ambiente de produção; nada de chave no banco nem na tela. Local: `stripe listen
--forward-to localhost:8080/api/stripe/webhook`. Produtos e preços criados por
`bun run stripe:seed` (`scripts/stripe-seed.ts`, idempotente; preço que mudou vira preço novo com
`transfer_lookup_key` e o antigo é arquivado; com chave de produção exige `--producao`).

**E-mail transacional e de notificação: Amazon SES** (decidido em 18/11/2026, #43; o dono do
projeto já usa nos outros projetos). Usado pelos avisos de inadimplência (#35), trial e cadastro.

O Stripe **não emite NFS-e**. Decidido: emissão manual no início; integração com emissor
(disparada no `invoice.paid`) depois.

Decisões de cobrança tomadas em 13/11/2026: autoatendimento + Admin Master; trial de 7 dias
reduzido; sem cobrança extra por uso, com corte rígido em 100%; inadimplência D+7 parcial,
D+10 integral, D+30 exclusão; NFS-e manual; anual paga 10 leva 12. Também confirmados: cartão
exigido no trial; limites do trial (1 condomínio, 50 moradores, 5 documentos, 150 respostas da IA,
só Haiku); unidade de uso = resposta da IA; no congelamento o agente só envia a resposta fixa
"atendimento indisponível" (sem IA); a exclusão mantém faturas e dados fiscais; anual cancela no
fim do período, sem reembolso proporcional. Em 18/11/2026: planos Essencial e Profissional por
condomínio, adicional de condomínio, WhatsApp por conta do cliente e e-mail como segundo canal
(milestone "Fase 6.5 — Canal de e-mail", #78–#83, depois da Fase 6 e antes do piloto). Análise:
documento "Precificação do OperaCondo Concierge" (https://claude.ai/artifact/5ePVPyiGsacKobq7sHBR9Y).
Pendente na conta Stripe: está como pessoa física (passar para o CNPJ) e o prefixo do extrato do
cartão é "BLOG TSV" (trocar para OPERACONDO).

## Entrega e versionamento

- Commit, PR e release pela skill `/create-commit` (global, em `~/.claude/skills/create-commit`).
  Nunca fazer merge nem push direto na `main`; quem faz o merge é o dono do projeto.
- `CHANGELOG.md` no formato Keep a Changelog, em português, com a seção `## [Não lançado]`
  (ainda não existe: a primeira entrega cria o arquivo). A versão só é decidida ao publicar a
  release; o projeto começa em `0.x` (primeira release `v0.1.0`; ainda não há tags).
- Escopos de commit: `app`, `agente`, `demandas`, `moradores`, `fornecedores`, `base`,
  `configuracoes`, `onboarding`, `admin`, `cobranca`, `db`, `infra`, `design`, `docs`.
- Nunca entram no commit: `.env*`, `node_modules/`, `.output/`, `.nitro/`, `.tanstack/`,
  `.claude/settings.local.json`.
- Verificação: `bun run typecheck`, `bun test` (precisa do banco local: `bun run db:up`) e
  `bun run build`. O CI (`.github/workflows/ci.yml`) roda tudo isso num banco novo, mais
  bootstrap, migrations, checagem de migration pendente e seed. Lint tem ~18 mil erros antigos
  (Prettier): comparar só erros novos nos arquivos alterados.
- Banco: mudou `src/server/db/schema.ts` → `bun run db:generate` (gera migration nova em
  `src/server/db/migrations`) → `bun run db:migrate`. SQL que o Drizzle não gera (RLS, funções,
  views) vai em migration própria: `bunx drizzle-kit generate --custom --name <nome>`. Nunca
  editar migration já aplicada. Tabela nova de cliente: `tenant_id`, `unique(tenant_id, id)`, FKs
  compostas com `tenant_id` e entrada na lista de RLS (o teste `tests/rls.test.ts` falha se faltar).
- Acesso a dados de cliente sempre por `withTenant(tenantId, tx => …)` (`src/server/db`); fora
  dele a RLS não devolve nada.
- Padrão de dados das telas (Fase 1): server functions em `src/lib/<area>.functions.ts`
  (`exigirCliente()` de `src/server/auth/contexto.ts` + `withTenant` + validação com zod) e, no
  navegador, `src/data/<area>.ts` com `queryOptions` + hooks (`useX()` lê, `useXAcoes()` grava e
  invalida o cache). Rotas fazem `loader: queryClient.ensureQueryData(...)` para a página chegar
  pronta do servidor. Dados de exemplo ficam só em `scripts/dados-exemplo/` (seed).
- Prettier só em arquivos novos ou já formatados; não formatar arquivos antigos inteiros.
- **zod 4** (uma versão só na árvore, a mesma do `better-auth` e do TanStack): objeto com padrões
  internos usa `.prefault({})` (o `.default({})` do zod 4 não passa pelo schema); mensagem de
  erro é `error`, não `errorMap`. Duas versões do zod quebram o build de produção (#73): o CI
  sobe o servidor do build e confere página e login.

## Design system

Segue o `DESIGN.md` do OperaCondo Insights (`../operacondo-insights/DESIGN.md`, v1.0). Aplicado:

- `src/styles.css` tem os tokens do Insights. Os nomes antigos (`--color-brand`, `--color-navy`,
  `--color-on-surface-variant`…) são **apelidos legados**: código novo usa as classes semânticas
  (`bg-primary`, `text-muted-foreground`, `border-border`, `bg-ink`…). Ao migrar uma tela, apagar o
  apelido quando o último uso sumir.
- Correções de contraste já incluídas: `primary-strong` (D1), `success-strong` para verde como
  texto (D2), `warning-soft` (D5).
- `src/components/brand/Icon.tsx` é um **adaptador Material → Lucide**. Em código novo, importe o
  ícone do `lucide-react` direto.
- Inter via `@fontsource/inter` (sem Google Fonts). Modo escuro desligado.
- Nome do produto: **OperaCondo Concierge**. Sem jargão na interface ("cliente", não "tenant").
- Pendências: densidade de texto (12,5–13px) tela a tela; degradês das coleções da Base e dos
  avatares; logo do `AdminShell`; componentes `src/components/ui/*` do Insights; registrar no
  `DESIGN.md` os componentes do Concierge (conversa, kanban, escala de urgência, citação de
  documento, exceção do ícone oficial do WhatsApp), com prefixo `concierge-`.

## Decisões em aberto

- Decisões de cobrança listadas na seção "Cobrança".
- Provedor do Postgres de produção (fica com o dono do projeto).
