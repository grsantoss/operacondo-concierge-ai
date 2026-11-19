# Changelog

Todas as mudanças relevantes deste projeto ficam aqui. Formato
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), versões em
[SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado

- **Avaliação do canal de e-mail**: `bun run evals email` manda 8 e-mails pelo caminho real
  (entrada, limpeza, roteamento e agente): vazamento, proposta de fornecedor, boleto da
  administradora, reclamação de barulho, reserva do salão, remetente forjado sem DKIM, resposta
  automática e e-mail com histórico citado. Confere também a categoria no motivo de ir ao
  síndico (#PR).

- **Conversas de WhatsApp e e-mail na mesma caixa**: `/app/agente` mostra o ícone do canal, filtra
  por canal e exibe o assunto do e-mail; no e-mail, Ctrl+Enter envia. O endereço de atendimento
  por e-mail aparece no onboarding (passo "Canais de atendimento") e em Configurações →
  Integrações, com status de recebimento e instruções para encaminhar do Gmail e do Outlook. O
  cliente pode começar só pelo e-mail. A confirmação de encaminhamento do Gmail chega ao síndico
  em vez de ser descartada (#97).

- **Resposta por e-mail**: "Aprovar e enviar" do rascunho funciona no e-mail. A resposta sai do
  endereço de atendimento do cliente, com o nome do condomínio, na mesma conversa do morador
  ("Re: assunto"), em texto e HTML simples. Nova opção em Configurações: "Enviar respostas por
  e-mail sem aprovação" (desligada; só respostas com base nos documentos). Checklist da SES
  (domínio, SPF, DKIM, DMARC, recebimento) em `docs/email-ses.md` (#96).

- **Agente no e-mail**: o morador é reconhecido pelo e-mail cadastrado, mas só quando o e-mail é
  autêntico (DKIM ou DMARC aprovados); remetente sem autenticação é tratado como desconhecido
  (só regras públicas). O agente escreve a resposta em tom de e-mail, com a fonte, e ela vira
  rascunho para o síndico aprovar (nada é enviado sozinho). Remetentes que não são moradores
  (fornecedor, administradora…) vão ao síndico com a categoria. Gás, incêndio, elevador e
  vazamento no assunto ou no corpo alertam o síndico. Cadastro pelo e-mail com aceite da LGPD.
  A cota de respostas da IA passa a somar os dois canais (#95).

- **Recebimento de e-mail pela Amazon SES**: cada cliente tem um endereço de atendimento
  (`{nome}@EMAIL_DOMINIO`). O e-mail recebido vira conversa de e-mail para o síndico, só com a
  mensagem nova (sem histórico citado, assinatura e HTML), e os anexos ficam guardados.
  Respostas automáticas, listas, "fora do escritório" e e-mails do próprio Concierge são
  ignorados; o resultado de SPF, DKIM e DMARC fica registrado. Rota `POST /api/email/ses`
  (aviso do SNS com assinatura conferida), variáveis `EMAIL_DOMINIO` e `SES_ENTRADA_TOPICO` (#94).

### Alterado

- **Conversa com canal e endereço**: cada conversa passa a ter o canal (WhatsApp ou e-mail) e o
  endereço do remetente, preparando o atendimento por e-mail. Nova tabela `email_canais` (endereço
  de atendimento do cliente) e assunto/`Message-ID` nas mensagens. O WhatsApp segue igual; as
  conversas existentes viram de WhatsApp (#93).

## [0.7.0] - 2026-11-18

### Adicionado

- **Inadimplência automática (job diário)**: contada a partir do vencimento da fatura não paga.
  D+1 aviso no painel e por e-mail; D+7 suspensão parcial (painel só leitura, agente sem IA,
  urgências seguem); D+10 conta congelada (só a tela `/pagamento` abre e o WhatsApp responde
  "atendimento indisponível"); D+20 e D+27 e-mail com a data da exclusão; D+30 exclusão
  (cancela a assinatura no Stripe, desconecta o WhatsApp, apaga moradores, conversas, demandas,
  documentos, arquivos e logins; mantém faturas e dados fiscais). Pagar a fatura reativa na
  hora. E-mails pela Amazon SES (`SES_REMETENTE`, `SES_REGION`, `SES_ACCESS_KEY`,
  `SES_SECRET_KEY`) (#91).

- **Cobrança pelo Admin Master**: ao cadastrar um cliente, o admin escolhe mensal ou anual e
  cartão (gera o link do Stripe para o síndico) ou boleto (o Stripe envia a fatura por e-mail,
  com prazo escolhido), com 7 dias grátis se o CNPJ ainda não teve teste. No cliente: trocar de
  plano com cobrança proporcional, cobrança avulsa, reenviar, marcar como paga fora do Stripe,
  anular ou estornar fatura e cancelar a assinatura (no fim do período ou na hora). Em
  `/admin/financeiro`, o card do Stripe mostra só modo, conta e último webhook (sem chaves na
  tela), faturas pagas mostram "nota pendente" e o admin registra número e data da NFS-e. Pix
  nas faturas por e-mail fica desligado até o admin ligar (#90).

- **Limites do plano e corte da IA**: cadastrar ou reativar morador e enviar documento acima do
  limite do plano (por condomínio contratado; no teste grátis, os limites reduzidos) é bloqueado
  com uma mensagem clara. Ao chegar ao limite de respostas da IA do mês, ou ao teto técnico de
  custo (`USD_BRL` converte o custo para reais), o modelo não é chamado: o morador recebe o aviso
  fixo e a conversa vai para o síndico; as urgências continuam alertando. A partir de 80% das
  respostas, uma faixa no painel avisa o síndico (#89).

- **Aba "Plano e cobrança" do síndico**: em `/app/configuracoes?aba=plano`, o plano, o status,
  a próxima cobrança (ou o fim do teste grátis), o uso do mês comparado aos limites (respostas da
  IA, condomínios, moradores e documentos; no teste grátis valem os limites reduzidos) e as
  faturas com link para pagar e baixar o PDF. "Gerenciar pagamento" abre o Customer Portal do
  Stripe para trocar o cartão, ver faturas e cancelar no fim do período (#88).

- **Contratação pelo site, com 7 dias grátis**: página pública `/planos` (mensal ou anual),
  cadastro em `/cadastro` (seus dados, empresa e CNPJ validado) e pagamento no Stripe Checkout
  com cartão exigido e 7 dias de teste. A volta do pagamento ativa a conta na hora e abre o
  onboarding; quem ainda não pagou é levado para `/assinar` ao entrar. Um teste grátis por CNPJ,
  por número de WhatsApp e por cartão: quem repete assina sem os dias grátis (#86).

- **Webhook do Stripe e espelho da cobrança no banco**: `POST /api/stripe/webhook` confere a
  assinatura (`STRIPE_WEBHOOK_SECRET`), grava o evento uma vez só em `stripe_eventos` e responde
  na hora; o worker (fila `stripe`) busca no Stripe o estado atual da assinatura e da fatura e
  atualiza `assinaturas` (com a quantidade de condomínios) e `faturas` (meio de pagamento e
  estorno). O status do cliente (trial, ativo, inadimplente, cancelado) e a data de início da
  inadimplência passam a ser derivados da cobrança. Objetos de outros produtos da mesma conta
  Stripe são ignorados (#85).

- **Produtos e preços do Concierge no Stripe por script**: `bun run stripe:seed` cria ou atualiza
  os planos Essencial e Profissional (mensal e anual, anual = 10 × mensal) e o adicional WhatsApp
  gerenciado, a partir da tabela `planos`. O preço é escalonado pelo número de condomínios e usa
  `lookup_key` com prefixo `concierge_`, porque a conta Stripe é dividida com o Insights. Preço
  alterado vira preço novo e o antigo é arquivado; com chave de produção, exige `--producao` (#84).

- **Aprovação dos cadastros feitos pelo WhatsApp**: quem se cadastra com o agente no 1º contato
  aparece em Moradores, num cartão "esperando aprovação", com o que informou da unidade e um selo
  no menu. O síndico aprova (informando bloco e apartamento, ou quadra e casa, quando o agente não
  achou a unidade) ou recusa. Aprovado, o morador passa a ver as regras de moradores, as próprias
  demandas e os dados da unidade; recusado, o agente continua só com as regras públicas (#77).

### Alterado

- **Planos novos: Essencial (R$ 197, 1 condomínio) e Profissional (R$ 547, 5 condomínios)**, com
  condomínio adicional a R$ 97. Os limites de moradores, documentos, respostas da IA e o teto de
  custo da IA passam a valer por condomínio da assinatura; o portal `/admin` mostra isso. Os
  planos Starter, Pro e Enterprise saem da venda. Migrations `0014` e `0015` (#84).

### Corrigido

- **Cadastros pendentes apareciam na lista de moradores** quando o agente já tinha ligado a
  unidade, e ocupavam a unidade como se ela não estivesse vaga (#77).

## [0.6.0] - 2026-11-17

### Adicionado

- **Observabilidade da IA e dos erros**: com as chaves configuradas, cada resposta do agente vira
  um rastro no Langfuse auto-hospedado (mensagens, ferramentas usadas, tokens e custo por rodada,
  sessão = conversa), e a escolha do síndico sobre o rascunho (aprovado, editado, reescrito) vira
  nota de qualidade. Erros do servidor, do worker e do navegador vão para o Sentry. CPF, telefone
  e o segredo do webhook são mascarados antes de qualquer envio; sem as chaves, nada é enviado.
  Em dev, `bun run langfuse:up` sobe o painel (#72).
- **Avaliação do agente** (`bun run evals`): 22 perguntas de um condomínio fictício, com a
  resposta esperada (responder citando o artigo certo, mandar ao síndico quando não há base,
  abrir demanda, não vazar documento interno, resistir a pedido para ignorar as instruções). O
  script roda o agente de verdade e mostra o que passou; com o Langfuse, cada execução vira um
  experimento sobre o dataset `concierge-perguntas`, para comparar modelos e mudanças no prompt (#75).

### Corrigido

- **Servidor de produção respondia erro 500 em todas as páginas** (`bun run build && bun start`;
  o `bun run dev` funcionava): o login usa o zod 4 e o projeto estava no zod 3, e o empacotamento
  de produção juntava as versões erradas. O projeto passa para o zod 4, e o CI agora sobe o
  servidor de produção e confere a página inicial e o login (#74).
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

[Não lançado]: https://github.com/grsantoss/operacondo-concierge-ai/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/grsantoss/operacondo-concierge-ai/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/grsantoss/operacondo-concierge-ai/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/grsantoss/operacondo-concierge-ai/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/grsantoss/operacondo-concierge-ai/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/grsantoss/operacondo-concierge-ai/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/grsantoss/operacondo-concierge-ai/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/grsantoss/operacondo-concierge-ai/releases/tag/v0.1.0
