# Changelog

Todas as mudanças relevantes deste projeto ficam aqui. Formato
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), versões em
[SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado

- **Observabilidade da IA e dos erros**: com as chaves configuradas, cada resposta do agente vira
  um rastro no Langfuse auto-hospedado (mensagens, ferramentas usadas, tokens e custo por rodada,
  sessão = conversa), e a escolha do síndico sobre o rascunho (aprovado, editado, reescrito) vira
  nota de qualidade. Erros do servidor, do worker e do navegador vão para o Sentry. CPF, telefone
  e o segredo do webhook são mascarados antes de qualquer envio; sem as chaves, nada é enviado.
  Em dev, `bun run langfuse:up` sobe o painel (#72).

### Corrigido

- **Servidor de produção respondia erro 500 em todas as páginas** (`bun run build && bun start`;
  o `bun run dev` funcionava): o login usa o zod 4 e o projeto estava no zod 3, e o empacotamento
  de produção juntava as versões erradas. O projeto passa para o zod 4, e o CI agora sobe o
  servidor de produção e confere a página inicial e o login.
- **Tela de conversas quebrava quando uma conversa tinha demanda aberta pelo agente**: a lista de
  prioridades das demandas chegava como texto e a página `/app/agente` dava erro (#72).

## [0.5.0] - 2026-11-17

### Adicionado

- **Conexão do WhatsApp pela Z-API**, no onboarding (passo 4) e em Configurações → Integrações:
  o síndico informa o número, o Instance ID, o Token e o Client-Token, salva, e o Concierge
  verifica na Z-API. Sem pareamento, mostra o QR Code (renovado sozinho por alguns instantes);
  pareado, mostra "Conectado" e avisa se o número pareado for outro ou se o celular estiver sem
  internet. Também dá para desconectar. Um número por cliente, para todos os condomínios (#58).
- **Recebimento das mensagens do WhatsApp**: a Z-API entrega cada mensagem em
  `/api/whatsapp/zapi/{segredo}`, que confere a origem, ignora repetições, grupos e mensagens do
  próprio número, enfileira e responde na hora. Mensagens seguidas do mesmo morador são juntadas
  (espera de 8 s) e processadas por um worker (`bun run worker`). Ao verificar o canal, o
  Concierge registra essa URL na Z-API sozinho (precisa de `APP_URL` em https) (#59).
- **Roteamento das mensagens por condomínio**: o número do canal identifica o cliente e o
  telefone do morador, o condomínio. Morador de um condomínio só segue direto; de vários, ou número
  desconhecido, recebe um menu numerado com os condomínios e responde com o número ou o nome. As
  mensagens passam a ser gravadas na conversa (sem duplicar) e o morador recebe a confirmação de
  que a administração foi avisada. Sem condomínio definido, nada específico é respondido (#60).
- **Conversas do WhatsApp ao vivo em `/app/agente`**: a tela deixa os exemplos e mostra as
  conversas reais, com condomínio, unidade, urgência (a maior entre a conversa e as demandas
  abertas dela) e estado. Mensagens novas aparecem sem recarregar a página. O síndico responde
  pelo WhatsApp direto da tela (e assume a conversa ao responder), assume ou marca como
  resolvida, e abre uma demanda já com o condomínio e o morador. O conselho só acompanha (#61).
- **Alertas de urgência sem IA**: mensagens com gás, incêndio ou fumaça, alguém preso no
  elevador ou vazamento de água mudam a urgência da conversa na hora (Crítica; vazamento, Alta)
  e avisam pelo WhatsApp pessoal os síndicos do condomínio, sem depender da IA nem do plano. Cada
  síndico informa o seu número em Configurações → Integrações (ou no onboarding). No painel, o
  menu "Agente IA" fica vermelho em qualquer tela e `/app/agente` destaca as conversas críticas.
  Um alerta por conversa e tipo a cada 30 minutos (#62).
- **Áudio, foto e documento do WhatsApp**: o arquivo é guardado no S3 e aparece na conversa em
  `/app/agente` (foto em miniatura, áudio com player, documento como link). Áudio é transcrito
  quando há provedor configurado (`TRANSCRICAO_PROVEDOR` = `openai` ou `deepgram`, mais
  `TRANSCRICAO_API_KEY`); sem provedor, o áudio fica só para ouvir. O texto transcrito passa
  pelas regras de urgência, e o alerta ao síndico mostra a transcrição (#63).
- **Leitura dos documentos da base**: o documento enviado em `/app/base` é lido sozinho e fica
  "Pronto para a IA", com o número de trechos. PDF, DOCX e imagem passam pelo Docling interno (com
  OCR); páginas que ele não lê bem vão para o Claude (só essas páginas). O texto é cortado por
  artigo ou cláusula, para a IA citar o artigo; atas, por assunto. Página ilegível deixa o
  documento em "Revisar" com o motivo, e erro de leitura mostra a causa, com a opção "Ler de
  novo". Arquivo `.doc` (Word antigo) recebe a orientação de salvar como `.docx` ou PDF (#66).
- **Agente de IA no WhatsApp (núcleo)**: com a chave do Claude configurada, o Concierge responde
  o morador sozinho com base nos documentos do condomínio (convenção, estatuto, regimento, atas),
  respeitando a prevalência entre eles, e termina a resposta com a fonte ("📄 Regimento Interno,
  Art. 12"). Morador sem cadastro aprovado só recebe regras públicas; documentos internos e do
  conselho nunca entram. Quando os documentos não respondem, ou o pedido depende do síndico, o
  morador recebe um aviso e a conversa vai para "Aguardando síndico". Sem a chave, tudo continua
  indo direto ao síndico. Custo de cada resposta registrado por cliente e condomínio (#67).
- **Agente abre demandas e faz o cadastro pelo WhatsApp**: o Concierge agora abre demandas
  sozinho quando o morador relata um problema (e informa o código), consulta e comenta as
  demandas do próprio morador, busca regras em atas e comunicados, cadastra número novo como
  pendente (com unidade, vínculo e aceite da LGPD, para o síndico aprovar), troca o condomínio
  da conversa quando o morador é de outro e passa a conversa ao síndico quando o assunto pede.
  Orçamento acima do limite de aprovação vai para "Triagem" aguardando o síndico (#68).
- **Rascunho da IA para o síndico aprovar**: quando a conversa vai para o síndico, a tela de
  conversas mostra o motivo ("Sem base documental", reclamação de vizinho…) e a resposta que a IA
  sugeriu, com "Aprovar e enviar" e "Editar". Cada resposta do síndico registra se o rascunho foi
  aprovado sem edição, editado ou reescrito, para medir a qualidade do agente (#70).

### Corrigido

- **Ordem das mensagens**: a mensagem do morador aparece antes da resposta automática enviada
  no mesmo instante (#63).

### Segurança

- **CPF e telefone não vão para a IA**: números de CPF e de telefone escritos nas conversas
  são trocados por "[CPF]" e "[telefone]" antes de qualquer envio ao Claude; nos documentos do
  condomínio sai o CPF e ficam os telefones de contato publicados pelo síndico (#69).
- **Tokens da Z-API cifrados no banco** (AES-256-GCM, chave em `CREDENCIAIS_CHAVE`) e nunca
  devolvidos ao navegador; só o síndico (não o conselho) configura o canal (#58).
- **Webhook com segredo por canal**: a Z-API não assina as chamadas, então a URL leva um segredo
  aleatório (no banco fica só o hash) e a instância do payload precisa ser a do canal (#59).

### Removido

- **Dados de exemplo e controles simulados de `/app/agente`**: conversas fictícias, indicadores
  inventados ("Resolução autônoma 94%", "Tempo médio IA") e o seletor de tom de voz da tela, que
  não salvava (o tom fica em Configurações → Agente) (#61).

## [0.4.0] - 2026-11-16

### Adicionado

- **Cadastro de cliente pelo Admin Master gravado de verdade**: cria o cliente em trial de 7 dias
  com o plano escolhido e o acesso do síndico, com senha temporária mostrada uma única vez. CNPJ e
  e-mail repetidos são recusados (#55).
- **Limites dos planos editáveis** em `/admin/ambientes` (condomínios, moradores, documentos,
  respostas da IA por mês), gravados na tabela `planos` (#55).
- **Aba "Usuários" na ficha do cliente**, com quem tem acesso e o papel de cada um (#55).

### Alterado

- **Urgência no lugar de "temperatura"**: conversas e dashboard usam a mesma escala das demandas
  (Crítica, Alta, Normal), e a conversa assume a maior urgência entre a triagem dela e as demandas
  abertas. Saem "Tranquilo", "Atenção" e "Urgente" (#56).
- **Dashboard com as demandas do banco**: demandas abertas, críticas, em execução, resolvidas, a
  contagem por coluna do Kanban e a urgência das abertas. Saem os números inventados (resolução da
  IA, satisfação, variações). As conversas recentes seguem de exemplo até o WhatsApp (#56).
- **Contador do menu** "Demandas" mostra as demandas abertas de verdade; o de "Agente IA" sai até
  haver conversas (#56).
- **Portal `/admin` lendo o banco**: clientes, planos, assinaturas, uso do mês e faturas vêm do
  banco. MRR, receita e faturas vencidas são calculados dos dados reais. Trocar o plano e editar
  os dados do cliente passam a ser salvos (#55).
- **Uso medido em respostas da IA**, a unidade de cobrança, no lugar de "mensagens" (#55).

### Corrigido

- **Telas no celular (390px)**: cabeçalhos com vários botões, rodapé do onboarding, ficha do
  morador e painel do Admin Master não vazam mais na horizontal (#56).

### Removido

- **Ações simuladas do `/admin`**: chave de API, webhooks e escopos, suspender, excluir, marcar
  fatura como paga, reenviar e estornar. Status do cliente e cobrança passam a vir do Stripe
  (Fase 6) (#55).

## [0.3.0] - 2026-11-16

### Adicionado

- **Coleção Estatuto** na base de conhecimento (#52).

### Alterado

- **Configuração do agente gravada por condomínio**: tom de voz, assinatura, o que a IA resolve
  sozinha, regras de reclamações e de manutenção e o limite de aprovação do síndico (R$) passam a
  ser salvos no banco, um conjunto para cada condomínio (#53).
- **Fornecedores gravados no banco**: cadastro, edição, checklist de homologação (vale 12 meses),
  arquivamento e envio de documentos (PDF ou imagem, até 20 MB, no S3, com data de validade)
  passam a valer de verdade. CNPJ repetido no mesmo cliente é recusado (#51).
- **Base de conhecimento gravada no banco e no S3**: envio de PDF, DOCX, TXT, MD ou imagem (até
  20 MB, até 10 por vez) por condomínio, com coleção, visibilidade e vigência; abrir e remover o
  arquivo. A tela mostra os números reais e o status "Aguardando leitura" até a IA ler o conteúdo (#52).

### Removido

- **"Retreinar IA" e "Treinar automaticamente" na base**: eram simulados; a leitura dos
  documentos chega com a ingestão. O campo "Descrição" do envio também saiu (não era guardado) (#52).
- **Envio de `.doc` antigo**: a leitura de documentos não suporta esse formato; use DOCX ou PDF (#52).

### Corrigido

- **Telefone no cadastro de fornecedor**: "11 98888-7777" era transformado em "+11 (98)…" e
  recusado. Agora aceita o número com ou sem +55 e guarda no padrão internacional (E.164) (#51).

## [0.2.0] - 2026-11-14

### Alterado

- **Demandas gravadas no banco**: o kanban, o detalhe e a abertura de demanda pelo painel passam
  a valer de verdade. Abrir, assumir e resolver ficam na linha do tempo com o nome de quem fez, e
  o prazo (SLA) sai da prioridade: Crítica 2h, Alta 6h, Normal 24h (#49).
- **Anexos das demandas guardados no S3**: imagem, vídeo ou PDF de até 20 MB, abertos por um link
  que vale 15 minutos (#49).
- **Moradores e condomínios gravados no banco**: cadastro, edição, importação CSV, arquivamento,
  reativação e exclusão passam a valer de verdade (antes sumiam ao recarregar a página) (#48). A
  importação CSV é tudo ou nada: se uma linha falhar, nenhuma é gravada (#48).
- **Telefone sempre no padrão internacional (E.164)**: aceita "(11) 99999-0000", "11 99999-0000"
  ou "+55 11 99999-0000" e recusa número repetido no mesmo condomínio (#48).

### Removido

- **Filtro e selo de "temperatura" nas demandas**: a urgência é só a prioridade (Crítica, Alta,
  Normal) (#49).

### Segurança

- **CPF do morador nunca fica em texto no banco**: só um hash e os dois últimos dígitos (#48).

## [0.1.0] - 2026-11-14

### Adicionado

- **Banco de dados Postgres com as 23 tabelas do produto** (Drizzle, `src/server/db`), com
  migrations que rodam sem superusuário e `db/bootstrap.sql` para preparar o banco uma vez. (#46)
- **Isolamento entre clientes no banco (RLS)**: cada síndico só enxerga os dados do próprio
  cliente, inclusive em referências entre tabelas; testes automáticos provam o isolamento. (#46)
- **Login de verdade** com e-mail e senha (Better Auth): `/app` exige login e `/admin` só abre
  para o Admin Master; "Sair" encerra a sessão. (#46)
- **Ambiente local com um comando** (`bun run db:reset`): Postgres, armazenamento S3 e dados de
  exemplo. (#46)
- **CI no GitHub** em toda PR: tipos, migrations num banco novo, testes de isolamento, seed e
  build. (#46)
- **`CLAUDE.md` com as decisões do produto e da arquitetura**: WhatsApp por síndico, Postgres com
  RLS, agente com ferramentas, cobrança pelo Stripe, observabilidade (Langfuse + Sentry) e
  ordem de execução do backend. (#1)
- **Protótipo navegável de todas as telas** (feito no Lovable antes do versionamento): caixa de
  conversas do agente, demandas em kanban, moradores com importação CSV, fornecedores, base de
  conhecimento, configurações, onboarding e portal Admin Master, com dados de exemplo.

### Alterado

- **Visual segue o design system do OperaCondo**: cores, tipografia (Inter local, sem Google
  Fonts), sombras e cores de status vêm dos tokens do OperaCondo Insights em `src/styles.css`. (#1)
- **Ícones passam a ser Lucide** por meio de um adaptador em `src/components/brand/Icon.tsx`, e o
  logo usa o ícone oficial do OperaCondo. (#1)
- **Nome do produto padronizado como "OperaCondo Concierge"** e "tenant" vira "cliente" na
  interface; páginas de erro e 404 em português. (#1)
- **Configurações do agente sem o controle "Autonomia da IA (%)"**: no lugar, um texto explica a
  regra (com base documental o agente responde e cita; sem base, o síndico aprova). (#1)
- **Servidor Node próprio**: `bun run build && bun start` gera e roda
  `.output/server/index.mjs`, sem depender do Lovable nem do Cloudflare. (#1)

### Removido

- **Opção "Meu usuário é Admin Master"** em `/admin/configuracoes`: o papel agora vem do
  cadastro do usuário. (#46)
- **Integração com o Lovable**: configuração do Vite, relatório de erros, link de ajuda e
  arquivos `.lovable/`. (#1)
- **Seletor de tema** em Configurações → Aparência (o modo escuro está desligado). (#1)

[Não lançado]: https://github.com/grsantoss/operacondo-concierge-ai/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/grsantoss/operacondo-concierge-ai/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/grsantoss/operacondo-concierge-ai/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/grsantoss/operacondo-concierge-ai/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/grsantoss/operacondo-concierge-ai/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/grsantoss/operacondo-concierge-ai/releases/tag/v0.1.0
