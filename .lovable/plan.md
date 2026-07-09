# Plano — Melhorias na página `/app/moradores`

## 1. Importação de moradores via CSV

**Objetivo:** permitir que o síndico traga uma lista pronta em vez de cadastrar um a um.

- Novo modal "Importar CSV" acionado pelo botão já existente no header.
- Etapas dentro do modal:
  1. **Upload / Drag-and-drop** de arquivo `.csv` (com link para baixar um *template* de exemplo).
  2. **Pré-visualização** das primeiras 5 linhas em tabela, com detecção automática de colunas.
  3. **Mapeamento de campos** (dropdown coluna do CSV → campo da aplicação) caso os headers não batam.
  4. **Validação** com Zod: nome obrigatório, contato em formato de telefone, status entre os valores válidos, unidade preenchida. Linhas inválidas ficam destacadas com o motivo.
  5. **Confirmação**: mostra "X moradores prontos para importar, Y com erro" e botão *Importar*.
- Após importar, os novos moradores entram no estado local (mock) e aparecem imediatamente na lista.
- Link "Baixar modelo CSV" gera um arquivo com os headers padrão preenchidos com 2 linhas de exemplo.

**Campos padrão do card de morador (colunas do CSV):**

| Campo | Obrigatório | Observação |
|---|---|---|
| `nome` | sim | Nome completo ou "Família X" |
| `condominio` | sim | Nome do condomínio (case-insensitive) |
| `tipo_endereco` | sim | `vertical` ou `horizontal` |
| `bloco` / `andar` / `apto` | se vertical | |
| `quadra` / `casa` | se horizontal | |
| `status` | sim | Residente / Locatário / Proprietário / Vago |
| `contato` | sim (exceto Vago) | Telefone com DDD |
| `email` | não | |
| `cpf` | não | Aceita mascarado |
| `vagas` | não | Default 0 |
| `pets` | não | Default 0 |
| `desde` | não | Mês/ano de entrada |

## 2. Seletor de condomínios em formato de lista/filtro

Substituir a faixa horizontal de cards grandes por um componente mais compacto e escalável:

- **Dropdown/Select** ("Condomínio: Todos ▾") no topo da barra de filtros — funciona bem com muitas propriedades.
- Ao lado, chips rápidos com os condomínios mais usados (opcional, top 3).
- Botão/opção **"Todos"** que lista *todos os moradores* de todos os condomínios (comportamento explícito na label e no contador).
- Os cards visuais grandes viram uma seção enxuta "Propriedades sob gestão" logo abaixo do header (uma linha por condomínio: ícone, nome, cidade, ocupação%), clicável para filtrar.

## 3. Dashboard superior mais informativo

Trocar os 4 stat cards atuais (Unidades, Ocupação%, Vagas, Pets) por um conjunto mais útil para o síndico:

- **Unidades** (total) + micro barra ocupadas/vazias.
- **Ocupação** (%) com delta vs. mês anterior (mock).
- **Moradores ativos** (Residente + Locatário + Proprietário).
- **Unidades vagas** (número absoluto — ação: abrir lista filtrada por Vago).
- **Novos moradores no mês** (contagem baseada em `desde`).
- **Pets registrados** (mantido, menor destaque).

Layout: 3 KPIs principais em destaque + 3 secundários compactos. Cada card é clicável e aplica o filtro correspondente (ex.: clicar em "Unidades vagas" seta `statusFilter = "Vago"`).

## 4. Ação de contato: telefone → WhatsApp

Na coluna **Ações** da tabela:

- Remover o ícone/link `tel:` (ligação telefônica).
- Manter apenas dois atalhos por linha (para moradores não-Vago):
  - **WhatsApp** (verde) — abre `wa.me/<telefone>` com mensagem inicial pré-preenchida ("Olá {nome}, aqui é do {condominio}…").
  - **Ver detalhes** — vai para `/app/moradores/$id`.
- O mesmo padrão vale para o card de detalhe do morador (`app.moradores.$id.tsx`): botão primário "Falar no WhatsApp".

## 5. Detalhes técnicos

- **Arquivos afetados:**
  - `src/routes/app.moradores.index.tsx` — reescrever seletor de condomínio, dash, filtros, ações da tabela.
  - `src/routes/app.moradores.$id.tsx` — substituir botão telefone por WhatsApp.
  - `src/data/moradores.ts` — expor helpers para gerar template CSV e converter linhas em `Morador`; adicionar estado inicial mutável (via um pequeno store em memória para receber importações durante a sessão).
  - Novo `src/components/moradores/ImportCsvModal.tsx` — modal isolado com upload, parsing (`papaparse`) e validação (`zod`).
  - Novo `src/components/moradores/CondoFilter.tsx` — dropdown + chips.
- **Dependências novas:** `papaparse` (parser CSV robusto e leve) e `@types/papaparse`.
- **Validação:** schema Zod compartilhado entre CSV e (futuro) formulário de novo morador.
- **Persistência:** por ora em memória (mock, coerente com o restante do app). Fácil trocar por Lovable Cloud depois.
- **Acessibilidade:** modal com foco preso, `aria-label` nos botões de ação, mensagens de erro por linha do CSV.

## Fora de escopo desta rodada
- Persistência real em banco de dados.
- Formulário completo de "Novo morador" (o botão já existe; será alvo de outra iteração).
- Edição em massa após importar.
