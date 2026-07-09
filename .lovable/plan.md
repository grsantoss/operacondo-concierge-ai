
# Ajustes na página `/app/fornecedores`

Objetivo: tornar funcionais os botões atualmente decorativos, trocar o botão "WhatsApp" por um ícone, e adicionar um sistema de filtros eficiente. Manter o padrão visual e o mock in-memory já usado no projeto.

## 1. Estrutura de dados (novo `src/data/fornecedores.ts`)

Hoje os fornecedores são um array hardcoded dentro de `app.fornecedores.index.tsx`. Vamos extrair para um módulo dedicado (mesmo padrão de `moradores.ts` / `demandas.ts`) com:

- Tipo `Supplier` ampliado com: `id`, `email`, `docs: { name, kind, validUntil?, uploadedAt }[]`, `homologacao: { criteriosOk: string[], pendencias: string[], validoAte?: string }`.
- Seed convertido a partir do array atual, com dados fictícios para docs/homologação.
- Funções mutadoras in-memory: `updateSupplier(id, patch)`, `homologarSupplier(id, payload)`, `arquivarSupplier(id)`, `reativarSupplier(id)`.

## 2. Critérios de homologação

Definir uma constante `CRITERIOS_HOMOLOGACAO` compartilhada:

1. CNPJ ativo (consulta manual / anexo do cartão CNPJ)
2. Contrato social atualizado
3. Certidão negativa de débitos (federal, estadual, municipal)
4. Comprovante de regularidade FGTS
5. Certidão trabalhista (CNDT)
6. Apólice de responsabilidade civil vigente
7. ART / ordem de serviço quando aplicável (elétrica, elevadores, HVAC)
8. Avaliação técnica interna com nota mínima 4.0

Cada critério tem `id`, `label`, `descricao`, `obrigatorio: boolean`.

## 3. Modal "Homologações" (botão do header)

Trocar o botão estático por abertura de um modal (`HomologacoesModal`) que mostra:

- Lista de critérios com checkbox (marcar/desmarcar).
- Filtro por fornecedor: dropdown com os suppliers.
- Painel lateral: status de cada fornecedor selecionado (X de N critérios atendidos, pendências, validade).
- Ação "Marcar como homologado" quando todos os obrigatórios estiverem OK → chama `homologarSupplier` e atualiza estado para `Homologado` com `validoAte = hoje + 12 meses`.
- Ação "Solicitar renovação" quando `validoAte` estiver a menos de 60 dias.

## 4. Ações do card

### 4.1 Botão WhatsApp → ícone
- Remover o botão largo "WhatsApp".
- Substituir por um botão-ícone quadrado (mesma altura dos outros dois: 40x40) com `Icon name="chat"` (ou uso do lucide `MessageCircle`). Cor verde para manter a associação.
- Ao clicar: abre `https://wa.me/<telefone sanitizado>?text=<mensagem pré-pronta>` em nova aba. Sanitizar `contato` (remover +, espaços, traços, parênteses) e prefixar `55` se ausente.
- Mensagem: `Olá {nome}, aqui é do condomínio OperaCondo sobre serviços da categoria {categoria}...`.

### 4.2 Ícone de folha (`description`)
- Vira botão "Ver ficha" que abre um `FichaFornecedorModal` (drawer lateral).
- Conteúdo: dados cadastrais completos, categoria, CNPJ, contatos, docs anexados (lista `docs`), status de homologação com barra de progresso dos critérios, últimos serviços (contador `ultimos`), rating.
- Botão secundário no rodapé: "Editar" (placeholder → abre `EditSupplierModal` reutilizando padrão do `EditMoradorModal`).

### 4.3 Menu "três pontos" (`more_horiz`)
- Vira um menu dropdown (Popover simples com estado local) com opções:
  - "Editar fornecedor" → abre `EditSupplierModal`.
  - "Ver histórico de serviços" → placeholder (toast "Em breve", já que não há dados reais).
  - "Solicitar homologação" → abre `HomologacoesModal` pré-selecionando esse fornecedor.
  - "Copiar CNPJ" → `navigator.clipboard.writeText`, toast de confirmação.
  - Divider.
  - "Arquivar fornecedor" (destrutivo) → `ConfirmDialog` reutilizando o componente já existente, chama `arquivarSupplier` e move para `estado: "Inativo"`.

## 5. Sistema de filtros

Adicionar acima do grid de cards uma barra de filtros com estado local (`useState`) — sem persistir na URL nesse primeiro momento, para manter escopo. Componentes:

- **Busca textual** (input com ícone de lupa): filtra por `nome`, `cnpj`, `categoria`, `contato` (match case-insensitive, sem acentos).
- **Chips de estado** (Homologado / Em análise / Renovação / Inativo): múltipla seleção, cada chip mostra a contagem.
- **Select de categoria**: dropdown com todas as categorias distintas do dataset + opção "Todas".
- **Select de rating mínimo**: `Todos`, `≥ 4.0`, `≥ 4.5`, `≥ 4.8`.
- **Toggle "Apenas com serviços recentes"** (`ultimos > 0`).
- **Ordenação** (dropdown à direita): Nome A→Z, Rating desc, Nº de serviços desc, Estado.
- **Botão "Limpar filtros"** aparece quando qualquer filtro está ativo.

Os cards passam a ser derivados de `useMemo(() => applyFilters(suppliers, filters), [...])`. Os cartões-resumo do topo (Homologados/Em análise/Renovação/Categorias) passam a refletir o dataset completo (não os filtros), para não confundir com contagens variáveis.

Vazio: quando o resultado for `[]`, mostrar placeholder com ícone e botão "Limpar filtros".

## 6. Arquivos afetados

- Novo: `src/data/fornecedores.ts`
- Novo: `src/components/fornecedores/HomologacoesModal.tsx`
- Novo: `src/components/fornecedores/FichaFornecedorModal.tsx`
- Novo: `src/components/fornecedores/EditSupplierModal.tsx`
- Novo: `src/components/fornecedores/SupplierCardMenu.tsx` (menu dos três pontos)
- Novo: `src/components/fornecedores/SuppliersFilters.tsx`
- Editar: `src/routes/app.fornecedores.index.tsx` (consumir dataset novo, integrar filtros, trocar WhatsApp por ícone, ligar menu/ficha, abrir modal de homologações).

## Fora do escopo

- Persistência real (Cloud/BD), upload real de documentos, integração com Receita Federal para CNPJ, notificação automática de vencimento, página de fornecedores arquivados (podemos abordar em iteração seguinte, análogo à `/moradores/arquivados`).
