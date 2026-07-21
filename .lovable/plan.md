
## Portal Admin Master — Gestão Multi-Tenant OperaCondo

Novo portal paralelo ao `/app`, isolado em `/admin`, onde o **admin master** (nível OperaCondo, não o síndico) gerencia todos os síndicos/condomínios (tenants) da plataforma, suas APIs individuais, cobranças Stripe e visão financeira consolidada. Segue o mesmo padrão visual da aplicação atual (Deep Navy sidebar, tokens do design system, mocks in-memory como o restante), sem backend real nesta fase.

---

### 1. Arquitetura de rotas

```text
src/routes/
├── admin.tsx                    # Layout (AdminShell + <Outlet />)
├── admin.index.tsx              # Dash financeiro (home do portal)
├── admin.usuarios.tsx           # Layout listagem
├── admin.usuarios.index.tsx     # Lista/CRUD de tenants (síndicos)
├── admin.usuarios.$id.tsx       # Detalhe do tenant (perfil, API, uso, cobrança)
├── admin.usuarios.novo.tsx      # Wizard de criação de tenant
├── admin.ambientes.tsx          # Configuração de ambiente por tenant/global
├── admin.financeiro.tsx         # Dash financeiro detalhado + cobranças Stripe
└── admin.configuracoes.tsx      # Config global do portal admin
```

Entrada: link "Portal Admin" no menu do usuário do `AppShell` (visível só para role `admin_master` — mock via flag local).

### 2. Componentes e dados (mocks)

- `src/components/admin/AdminShell.tsx` — clone enxuto do `AppShell` com sidebar própria (Dashboard, Usuários, Ambientes, Financeiro, Configurações) e badge "Admin Master".
- `src/data/tenants.ts` — store reativo com tenants: `{ id, razaoSocial, nomeFantasia, cnpj, email, plano, status (ativo/suspenso/trial), createdAt, apiKey, apiStatus, mrr, uso: { demandas, moradores, msgs } }`. Seguir padrão de `moradores.ts`/`fornecedores.ts`.
- `src/data/faturas.ts` — histórico mock de cobranças Stripe: `{ id, tenantId, valor, status (paid/open/past_due/void), periodo, stripeInvoiceId, metodo }`.
- `src/data/planos.ts` — Starter / Pro / Enterprise com limites e preços.

### 3. Gestão de usuários (tenants)

**`admin.usuarios.index.tsx`** — lista de tenants:
- Tabela com filtros (status, plano, busca) reusando padrão dos filtros de `/moradores` e `/fornecedores`.
- Ações por linha: ver, editar, suspender/reativar, excluir (com confirm dialog padrão `ConfirmDialog`).
- Botão "Novo usuário" → `admin.usuarios.novo.tsx`.

**`admin.usuarios.novo.tsx`** — wizard em 3 passos (mesmo padrão do onboarding):
1. Dados corporativos do tenant (razão social, CNPJ, endereço, responsável).
2. Plano + limites (moradores, mensagens/mês, condomínios).
3. Provisionamento: gera API Key mock (`ock_live_...`), cria conta stub Stripe Customer, define credenciais iniciais (email + senha temp). Tela de sucesso com credenciais copiáveis.

**`admin.usuarios.$id.tsx`** — abas:
- **Perfil**: edição completa dos dados corporativos (reaproveita layout do `CorporativoPanel` de `/configuracoes`).
- **API & Integrações**: exibe API Key com toggle mostrar/ocultar, botão "Rotacionar chave" (gera nova mock), configuração de webhooks, escopos/permissões. Cada tenant tem **sua própria API Key** independente.
- **Uso**: KPIs de consumo (demandas, mensagens WhatsApp, storage) vs limites do plano, com barras de progresso.
- **Cobrança**: plano atual, próxima fatura, método de pagamento Stripe, histórico de faturas do tenant.
- **Ações perigosas**: suspender acesso, excluir tenant (soft delete + purge, padrão da tela de arquivados).

### 4. Configuração de ambiente

**`admin.ambientes.tsx`** — dois níveis:
- **Global** (afeta toda a plataforma): feature flags (IA autônoma, WhatsApp Meta habilitado, novos módulos beta), limites default por plano, template de tom de voz padrão do agente.
- **Por tenant**: seletor de tenant → override de flags/limites específicos (ex.: liberar beta para cliente X, aumentar quota).
- Padrão visual de cards com toggles igual à aba "Agente IA" de `/configuracoes`.

### 5. Integração Stripe (mock nesta fase)

Componente `src/components/admin/StripeSection.tsx`:
- Bloco de conexão da conta Stripe da OperaCondo (badge "Conectado / Desconectado", chave publishable/secret mockadas, botão "Testar conexão").
- Por tenant: `stripeCustomerId` e `stripeSubscriptionId` mockados, ações "Ver no Stripe" (link externo stub), "Emitir cobrança avulsa", "Cancelar assinatura", "Reenviar fatura".
- Webhook events simulados em `src/data/faturas.ts` (paid, failed, refunded) para popular o dash.

Fora de escopo desta fase: chamadas reais à API Stripe, checkout, portal do cliente. Documentado no plano para etapa futura via `payments--enable_stripe_payments` quando o usuário quiser sair do mock.

### 6. Dash financeiro

**`admin.index.tsx`** (home) — KPIs executivos:
- MRR total, ARR, churn %, tenants ativos/trial/suspensos, ticket médio.
- Gráfico de receita mensal (SVG simples estilo do dash atual em `/app`).
- Top 5 tenants por receita.
- Últimas 10 cobranças com status colorido.

**`admin.financeiro.tsx`** — visão detalhada:
- Filtros (período, status, plano, tenant).
- Tabela de faturas com ações (reenviar, marcar como paga, estornar — todas mock).
- Export CSV (reaproveita padrão do export do dash de `/app/index`).
- Cards de inadimplência (past_due) e cobranças em aberto.

### 7. Acesso e navegação

- Flag `isAdminMaster` mock em `src/lib/admin.ts` (localStorage `oc.admin.master`, default `true` em dev para permitir testes).
- Item "Portal Admin" no `UserMenu` do `AppShell` só aparece se `isAdminMaster`.
- `AdminShell` mostra botão "Voltar para app do síndico" que retorna a `/app`.
- Sem autenticação real: fora de escopo (mocks in-memory como o resto do projeto).

### 8. Fora de escopo

Persistência real, autenticação/autorização server-side, chamadas reais Stripe/webhooks, isolamento real de dados por tenant no backend, geração real de API Keys, envio de e-mails de convite, RBAC completo. Tudo permanece mock in-memory alinhado ao padrão atual do projeto.

### 9. Arquivos a criar/editar

**Criar**: `src/components/admin/AdminShell.tsx`, `src/components/admin/StripeSection.tsx`, `src/data/tenants.ts`, `src/data/faturas.ts`, `src/data/planos.ts`, `src/lib/admin.ts`, e as 8 rotas listadas em §1.

**Editar**: `src/components/app/AppShell.tsx` (adicionar item "Portal Admin" no `UserMenu` condicional à flag).
