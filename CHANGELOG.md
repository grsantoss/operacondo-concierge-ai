# Changelog

Todas as mudanças relevantes deste projeto ficam aqui. Formato
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), versões em
[SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado

- **`CLAUDE.md` com as decisões do produto e da arquitetura**: WhatsApp por síndico, Postgres com
  RLS, agente com ferramentas, cobrança pelo Stripe, observabilidade (Langfuse + Sentry) e
  ordem de execução do backend. (#1)

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

- **Integração com o Lovable**: configuração do Vite, relatório de erros, link de ajuda e
  arquivos `.lovable/`. (#1)
- **Seletor de tema** em Configurações → Aparência (o modo escuro está desligado). (#1)
