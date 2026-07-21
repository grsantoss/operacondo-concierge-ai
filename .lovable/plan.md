## Ajustes no onboarding e configurações — Integração WhatsApp e regras

### 1. Novo step de onboarding: Conectar WhatsApp

Adicionar um novo step entre "Regras específicas" e "Revisão final", renumerando para 5 passos no total.

- **Step 4 — Conectar WhatsApp** (`StepWhatsApp`)
  - Cartão de escolha de provedor:
    - **Z-API** — integração rápida via QR Code, ideal para começar.
    - **WhatsApp Business API (Meta Cloud API)** — oficial, ideal para escala/alto volume.
  - Formulário condicional:
    - **Z-API**: Instance ID, Token, Client-Token (opcional), botão "Testar conexão" (mock) e placeholder de QR Code.
    - **Meta**: Phone Number ID, WABA ID, Access Token, Webhook Verify Token, botão "Validar credenciais" (mock).
  - Toggle "Pular por agora — conectar depois nas Configurações" para não bloquear ativação.
  - Estado visual: "Não conectado / Conectando / Conectado ✓" com badge.

Ajustes no wrapper:
- `STEPS` passa a ter 5 itens; "Revisão final" vira passo 5.
- Barra de progresso recalcula para `/5`.
- Card de revisão inclui linha "WhatsApp — Z-API (conectado) ou Não conectado".

### 2. Regras específicas (Step 3) — reformulação

**Remover:** Política de pets, Mudanças, Reserva de áreas comuns via IA.

**Manter:** Horário de silêncio.

**Adicionar:**
- **Regras para reclamações** — card com toggle "IA registra e classifica reclamações automaticamente" + textarea para instruções (ex.: barulho, vizinhança, áreas comuns) + select de prioridade padrão (Normal / Alta).
- **Regras para abertura de chamado de manutenção** — card com:
  - Select do canal preferencial (WhatsApp, Portal, ambos).
  - Toggle "Exigir foto/vídeo do problema".
  - Toggle "Aprovação do síndico para orçamentos acima de R$ X" + input de valor.
  - Textarea de instruções extras (ex.: elétrica, hidráulica, elevadores).

Atualiza também o card de revisão para refletir os novos tópicos ("Reclamações", "Manutenção") no lugar dos removidos.

### 3. Configurações (`/app/configuracoes`)

Reaproveitar a estrutura de abas existente:

- **Aba Integrações**: adicionar bloco "WhatsApp" com os mesmos campos do step de onboarding (Z-API vs Meta), badge de status, botões "Testar conexão", "Desconectar", "Reconectar". Substitui/expande o card genérico de WhatsApp já existente na aba.
- **Aba Agente IA** (ou nova seção "Regras de atendimento"): adicionar dois blocos espelhando as novas regras — Reclamações e Manutenção — com os mesmos controles do onboarding. Manter o toggle de silêncio no bloco existente.

Estado local com `useState` (sem persistência), mantendo o padrão mock do restante do app.

### 4. Arquivos afetados

- Editar: `src/routes/onboarding.tsx` — novo `StepWhatsApp`, reformulação de `StepRegras`, `StepRevisao` e array `STEPS`; footer/progresso passam a considerar 5 passos.
- Editar: `src/routes/app.configuracoes.tsx` — bloco WhatsApp expandido em Integrações + blocos de regras (Reclamações e Manutenção) em Agente IA.

### Fora de escopo

Persistência real de credenciais, chamadas reais à Z-API/Meta, criptografia de tokens, webhooks funcionais, painel de mensagens sincronizadas. Tudo permanece em mock in-memory.
