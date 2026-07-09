# Ajustes na página de demanda (`/app/demandas/$id`)

Objetivo: transformar os botões atualmente decorativos em ações reais, mantendo o padrão visual da página e o mock in-memory já usado em `src/data/demandas.ts`.

## Botões afetados e comportamento proposto

### 1. WhatsApp (sidebar do solicitante)
- Trocar o botão atual por um `<a>` que abre `https://wa.me/<telefone>?text=<mensagem pré-pronta>`.
- Sanitizar `demanda.contact.phone` (remover parênteses/espaços/traços) e assumir DDI `55` quando ausente.
- Mensagem pré-pronta: `Olá {morador}, sobre o chamado {id} — {title}...`.
- `target="_blank"` + `rel="noopener noreferrer"`.
- Bônus solicitado antes: o botão de telefone (linha "call") também vira link para WhatsApp; o e-mail continua `mailto:`.

### 2. Ficha (sidebar do solicitante)
- Converter em `<Link>` para `/app/moradores/$id`.
- Precisamos de um `moradorId` em cada demanda. Como o mock usa apenas o nome, vou:
  - Adicionar campo opcional `moradorId?: string` em `Demanda` (`src/data/demandas.ts`).
  - Preencher via lookup por nome no seed (best-effort), usando `src/data/moradores.ts`.
  - Se não houver match, o botão fica desabilitado com tooltip "Morador não vinculado".

### 3. Assumir conversa (cabeçalho da conversa)
- Adicionar campo `assumedBy?: string` na `Demanda` + função `assumirConversa(id, actor)` em `src/data/demandas.ts` que:
  - grava `assumedBy`,
  - adiciona evento na `timeline` ("Síndico assumiu a conversa"),
  - se `assigned` estiver vazio, define como o mesmo ator.
- No componente: `useRouter().invalidate()` + toast (reaproveitar toast existente).
- Estado assumido: botão muda para "Você assumiu" desabilitado, com ícone `check`.

### 4. Enviar (composer da conversa)
- Transformar o input em componente controlado (`useState`), com `textarea` auto-resize simples.
- Nova função `addMensagem(id, { from: "sindico", author, text })` em `demandas.ts` que:
  - anexa a `messages` com timestamp "agora",
  - adiciona entrada na `timeline` ("Enviou mensagem ao morador").
- Enter envia, Shift+Enter quebra linha. Desabilitar quando `text.trim() === ""`.
- Toast + `router.invalidate()` + limpa o campo + foca de novo.

### 5. Anexar arquivo (ícone de clipe no composer) e "+ Adicionar" (card Anexos)
- Ambos abrem o mesmo `<input type="file" hidden multiple>` (ref compartilhada).
- Ao selecionar arquivos:
  - inferir `kind` (`image` | `pdf` | `video`) pelo mime,
  - formatar tamanho ("245 KB", "1.2 MB"),
  - chamar nova `addAnexos(id, files[])` em `demandas.ts` que atualiza `attachments` e adiciona evento na timeline.
- Sem upload real: os arquivos ficam apenas no mock in-memory da sessão (limitação assumida — mesmo padrão dos outros mocks). Deixar comentário `// TODO: substituir por upload real quando integrar backend`.
- Botão `download` nos anexos existentes: quando não houver URL real, remover o botão (não faz sentido baixar mock); manter apenas quando `attachment.url` estiver definido no futuro.

## Arquivos a alterar

- `src/data/demandas.ts`
  - Ampliar tipo `Demanda` (`moradorId?`, `assumedBy?`).
  - Adicionar `assumirConversa`, `addMensagem`, `addAnexos`.
  - Seed: preencher `moradorId` por nome quando possível.
- `src/routes/app.demandas.$id.tsx`
  - Estado local para composer, ref do input file, handlers e toasts.
  - Trocar botões estáticos por ações reais.
  - Link para `/app/moradores/$id`, link `wa.me` para WhatsApp.

## Fora do escopo
- Persistência real, upload real de arquivos, threads/leitura por participante, notificação ao morador.
- Redesign da página — apenas comportamento.
