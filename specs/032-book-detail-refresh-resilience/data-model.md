# Data Model: Resiliência de Refresh no Detalhe do Livro + Skeleton do Detalhe

**Feature**: 032-book-detail-refresh-resilience | **Date**: 2026-06-10

> **Sem mudança de banco de dados.** Esta feature NÃO altera schema, migrations, índices, repositórios nem entidades de domínio puras (`lib/domain/`). O modelo abaixo descreve as entidades **existentes** envolvidas e os **deltas de contrato/estado** (camada de service, API e estado de UI) — todos propagando valores **já computados**.

## Entidades de domínio (existentes — referência)

### Capítulo (`Chapter`)

Unidade central. Atributos relevantes nesta feature:

| Campo | Tipo | Observação |
|---|---|---|
| `id` | string | identificador |
| `bookId` | string | FK para o livro |
| `title` | string | ≤ 100, sem `\n`/`\r`; em `PAID_LOCKED_FIELDS` |
| `position` | integer | ordem densa `0..N-1`; UNIQUE `(book_id, position)` deferrable |
| `status` | `ChapterStatus` | capítulo recém-criado entra em `pending` |
| `narratorId` | string \| null | `null` no recém-criado |
| `editorId` | string \| null | `null` no recém-criado |
| `editedSeconds` | integer | `0` no recém-criado → zero impacto em ganho |
| `deadline` | string \| null | `null` no recém-criado |

**Sem alteração.** A criação otimista apenas **reflete** o capítulo que o servidor persistiu.

### Livro (`Book`)

| Campo | Tipo | Observação |
|---|---|---|
| `status` | `BookStatus` | cache materializado, recomputado por `recomputeBookStatusAndBumpVersion` na mesma transação (Princípio I) |
| `chaptersVersion` | integer | token bumpado em **toda** mutação de capítulo; usado para detecção de conflito (`expectedVersion`) |

**Sem alteração de schema.** A feature apenas **propaga** `chaptersVersion` (já bumpado) para camadas externas.

## Deltas de Service (result types)

Os valores já são computados; o delta é **expor** `chaptersVersion` nos result types que hoje o descartam.

### `UpdateChapterResult`

```diff
 export interface UpdateChapterResult {
   readonly chapter: Chapter;
   readonly bookStatus: BookStatus;
+  readonly chaptersVersion: number;   // já computado por recomputeBookStatusAndBumpVersion
 }
```

### `DeleteChapterResult`

```diff
 export interface DeleteChapterResult {
   readonly bookId: string;
   readonly bookDeleted: boolean;
   readonly bookStatus: BookStatus | null;
+  readonly chaptersVersion: number | null;  // null quando bookDeleted (livro removido)
 }
```

### `BulkDeleteChaptersResult`

```diff
 export interface BulkDeleteChaptersResult {
   readonly bookId: string;
   readonly bookDeleted: boolean;
   readonly bookStatus: BookStatus | null;
   readonly deletedCount: number;
+  readonly chaptersVersion: number | null;  // null quando bookDeleted
 }
```

> `CreateChapterResult` **já** inclui `chaptersVersion` — sem alteração.
> Quando `bookDeleted = true`, não há livro nem token: `chaptersVersion = null` e a UI redireciona para `/books` (comportamento existente), sem aplicar bump.

## Estado de UI (`useBookDetail`)

`DetailState` permanece `{ status, chapters, pdfUrl }` e `chaptersVersion` continua içado em `useState`. Os deltas são de **comportamento dos callbacks**, não de forma do estado:

| Callback | Hoje | Depois |
|---|---|---|
| `handleChapterCreated(result)` | recebe `{ chaptersVersion, bookStatus }`; só seta token + `router.refresh()` | recebe `{ chapter, chaptersVersion, bookStatus }`; **insere o capítulo** em `state.chapters` no índice `chapter.position`, **re-densifica** `0..N-1`, aplica `bookStatus`, seta token; `router.refresh()` só como re-sync |
| `handleChapterSaved(updated, bookStatus, chaptersVersion)` | atualiza chapter local + refresh | + bump do token via novo `chaptersVersion` |
| `handleChapterDeleted(chapterId, bookDeleted, chaptersVersion)` | remove local + refresh | + bump do token (quando não `bookDeleted`) |
| `handleBulkDeleteConfirm()` | remove local + refresh; lê header `X-Book-Deleted` | + lê header `X-Chapters-Version` e bump |
| `handleChaptersConflict()` | `router.refresh()` | `async`: `GET /books/:id` via `apiFetch` → aplica `{ chapters, status, pdfUrl, chaptersVersion }` ao estado local |

**Mapeamento capítulo criado → `ChapterRowData`** (otimista):

```
{ id, title, position, status: "pending", narrator: null, editor: null, editedSeconds: 0, deadline: null }
```

## Regras / Invariantes preservadas

- **Ordem densa `0..N-1`**: garantida no cliente por `densifyPositions` (mesmo helper do servidor) após a inserção otimista — equivalente ao resultado persistido.
- **Sem renumeração de títulos** (pós-026): inserção otimista mexe só em `position`, nunca em `title`.
- **`book.status` é cache materializado**: a UI nunca calcula `book.status` autoritativamente fora do que o servidor devolve (`bookStatus` da resposta); a recomputação continua server-side na transação.
- **Imutabilidade `paid`**: inserção otimista só ocorre após `201` do servidor; nenhuma regra de `paid` é contornada. Erros (validação/conflito) → nada é inserido (FR-011).
- **Detecção de conflito**: `expectedVersion` enviado nas mutações declarativas (create/reorder) continua válido; o token re-sincronizado localmente evita conflito espúrio (FR-005/SC-005).

## Sem migrations

Nenhum arquivo em `drizzle/` é criado ou alterado. Nenhuma coluna, índice ou constraint muda. `bun run db:generate`/`migrate` **não** são executados nesta feature.
