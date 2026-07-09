# Plano — Edição, desativação e arquivo de moradores

## 1. Ações na página `/app/moradores/$id`

Adicionar dois novos botões no header (ao lado de "Voltar" e "WhatsApp") e refletir também no bloco lateral "Ações rápidas":

- **Editar** (ícone `edit`, estilo secundário): abre um modal `EditMoradorModal` com formulário completo do cadastro.
- **Desativar / Reativar** (ícone `person_off` / `person_check`, estilo vermelho ou âmbar):
  - Se o morador está ativo → botão "Desativar" com confirmação.
  - Se está desativado → botão "Reativar".
  - Ao desativar: status vira `"Inativo"` e o morador é removido da listagem principal, indo para a página de arquivados.

### Modal de edição
Campos editáveis (mesmos do schema `Morador`):
- Nome, CPF, e-mail, contato (WhatsApp)
- Condomínio (select), tipo de endereço (vertical/horizontal)
- Bloco/andar/apto **ou** quadra/casa (condicionais)
- Status (Ativo / Pendente / Vago / Inativo)
- Vagas, pets, "desde"

Validação leve inline (nome obrigatório, contato obrigatório, campos de endereço conforme o tipo). Salvar chama `updateMorador(id, patch)` no store em memória e fecha o modal.

## 2. Novo status "Inativo" e store

Em `src/data/moradores.ts`:

- Adicionar `"Inativo"` ao union `MoradorStatus` e estilo em `STATUS_CLS` (cinza).
- Novas funções expostas pelo store reativo:
  - `updateMorador(id, patch)`
  - `deactivateMorador(id)` / `reactivateMorador(id)`
  - `deleteMorador(id)` e `deleteAllInactive()`
  - `useMoradores({ includeInactive?: boolean })` — por padrão **exclui** inativos.
- Getter `getMorador(id)` continua retornando qualquer status (para permitir abrir o detalhe de um arquivado).

## 3. Filtragem na listagem `/app/moradores`

- A lista principal e as KPIs deixam de contar moradores `Inativo` (usa `useMoradores()` padrão).
- Adicionar no header um link discreto **"Arquivados (N)"** que leva para `/app/moradores/arquivados`, com contador dinâmico.
- Remover a opção "Inativo" dos filtros de status principais (fica exclusivo da página de arquivados).

## 4. Nova página `/app/moradores/arquivados`

Rota: `src/routes/app.moradores.arquivados.tsx`.

Conteúdo:
- AppShell com título "Moradores arquivados" e breadcrumb.
- Tabela simplificada: nome, condomínio, unidade, contato, "desativado em" (usa `desde` ou timestamp de desativação), ações:
  - **Reativar** (volta para "Ativo" e some da página).
  - **Excluir** (remove definitivamente, com confirmação).
- Barra superior:
  - Busca por nome.
  - Filtro por condomínio.
  - Botão vermelho **"Excluir todos os arquivados"** com modal de confirmação exigindo clique duplo/checkbox de segurança.
- Empty state amigável quando não há arquivados.

## 5. Detalhes técnicos

Arquivos novos:
- `src/components/moradores/EditMoradorModal.tsx`
- `src/components/moradores/ConfirmDialog.tsx` (reutilizável para desativar/excluir)
- `src/routes/app.moradores.arquivados.tsx`

Arquivos alterados:
- `src/data/moradores.ts` — status `Inativo`, novas mutations, filtro padrão no hook, campo opcional `desativadoEm`.
- `src/routes/app.moradores.$id.tsx` — botões Editar / Desativar / Reativar, integração com modal e confirmações; badge "Inativo" no hero quando aplicável.
- `src/routes/app.moradores.index.tsx` — usar hook filtrado, link para arquivados com contagem.

## 6. Fora do escopo

- Persistência real (segue em memória; troca para Lovable Cloud fica para depois).
- Histórico/auditoria de alterações.
- Undo após "Excluir todos".
