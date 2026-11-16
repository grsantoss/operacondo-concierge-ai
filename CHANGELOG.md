# Changelog

Todas as mudanças relevantes deste projeto ficam aqui. Formato
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), versões em
[SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado

- **Coleção Estatuto** na base de conhecimento.

### Alterado

- **Fornecedores gravados no banco**: cadastro, edição, checklist de homologação (vale 12 meses),
  arquivamento e envio de documentos (PDF ou imagem, até 20 MB, no S3, com data de validade)
  passam a valer de verdade. CNPJ repetido no mesmo cliente é recusado (#51).
- **Base de conhecimento gravada no banco e no S3**: envio de PDF, DOCX, TXT, MD ou imagem (até
  20 MB, até 10 por vez) por condomínio, com coleção, visibilidade e vigência; abrir e remover o
  arquivo. A tela mostra os números reais e o status "Aguardando leitura" até a IA ler o conteúdo.

### Removido

- **"Retreinar IA" e "Treinar automaticamente" na base**: eram simulados; a leitura dos
  documentos chega com a ingestão. O campo "Descrição" do envio também saiu (não era guardado).
- **Envio de `.doc` antigo**: a leitura de documentos não suporta esse formato; use DOCX ou PDF.

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

[Não lançado]: https://github.com/grsantoss/operacondo-concierge-ai/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/grsantoss/operacondo-concierge-ai/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/grsantoss/operacondo-concierge-ai/releases/tag/v0.1.0
