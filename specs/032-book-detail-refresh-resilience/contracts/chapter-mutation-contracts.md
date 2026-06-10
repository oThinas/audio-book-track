# Contract: Chapter Mutation Responses (delta)

**Feature**: 032-book-detail-refresh-resilience | **Date**: 2026-06-10

Contratos HTTP das mutações de capítulo. Apenas os **deltas** desta feature estão marcados; o restante permanece inalterado. Princípio X (REST) preservado: `204` para DELETE mantido, metadados de DELETE seguem o padrão de header já existente (`X-Book-Deleted`).

---

## POST `/api/v1/books/:bookId/chapters` — Criar capítulo

**Status quo (já satisfaz a feature — sem alteração).**

- **201 Created** + `Cache-Control: no-store`
- Body:

```json
{
  "data": {
    "chapter": {
      "id": "string",
      "bookId": "string",
      "title": "string",
      "position": 0,
      "status": "pending",
      "narratorId": null,
      "editorId": null,
      "editedSeconds": 0,
      "deadline": null,
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601"
    },
    "bookStatus": "pending",
    "chaptersVersion": 7
  }
}
```

- **409 Conflict** (`BOOK_CHAPTERS_VERSION_CONFLICT`) quando `expectedVersion ≠` versão atual — envelope de erro padrão.
- **422** título inválido (vazio, > 100, `\n`/`\r`) ou título duplicado.

**Consumo (cliente)**: `useAddChapter.onSubmit` repassa `result.data.data.chapter` + `bookStatus` + `chaptersVersion` para `onCreated` → inserção otimista.

---

## PATCH `/api/v1/chapters/:id` — Editar capítulo

**Delta**: adicionar `chaptersVersion` em `meta`.

- **200 OK** + `Cache-Control: no-store`
- Body:

```diff
 {
   "data": {
     "id": "string",
     "bookId": "string",
     "title": "string",
     "position": 0,
     "status": "reviewing",
     "narratorId": "string | null",
     "editorId": "string | null",
     "editedSeconds": 0,
     "deadline": "ISO-8601 | null",
     "createdAt": "ISO-8601",
     "updatedAt": "ISO-8601"
   },
   "meta": {
     "bookStatus": "reviewing",
+    "chaptersVersion": 8
   }
 }
```

**Consumo**: `useChapterRowEdit.persist` lê `meta.chaptersVersion` e o re-sincroniza via o callback `onVersionChange` (canal `onChaptersVersionChange` já existente, ligado a `handleChaptersVersionBump`). `onSaved(updated, bookStatus)` permanece inalterado — o token viaja pelo canal de versão, não pela assinatura de `onSaved`.

---

## DELETE `/api/v1/chapters/:id` — Excluir capítulo

**Delta**: adicionar header `X-Chapters-Version`. **`204` mantido** (Princípio X).

- **204 No Content** + `Cache-Control: no-store`
- Headers:

```diff
   X-Book-Deleted: "true"            # já existente — presente apenas quando o livro foi removido
+  X-Chapters-Version: "8"           # NOVO — presente apenas quando o livro NÃO foi removido
```

- Quando o último capítulo não-pago é removido e o livro é deletado: `X-Book-Deleted: true`, **sem** `X-Chapters-Version` (não há livro/token). Cliente redireciona para `/books`.

**Consumo**: `useDeleteChapter.handleDelete` lê `X-Chapters-Version` (quando presente) e o re-sincroniza via `onVersionChange` (canal `onChaptersVersionChange`). `onDeleted(chapterId, bookDeleted)` permanece inalterado.

---

## POST `/api/v1/books/:bookId/chapters/bulk-delete` — Excluir em massa

**Delta**: adicionar header `X-Chapters-Version`. **`204` mantido**.

- **204 No Content** + `Cache-Control: no-store`
- Headers:

```diff
   X-Book-Deleted: "true"            # já existente
+  X-Chapters-Version: "9"           # NOVO — presente apenas quando o livro NÃO foi removido
```

**Consumo**: `useBookDetail.handleBulkDeleteConfirm` (já lê `X-Book-Deleted`) passa a ler `X-Chapters-Version` e aplica via `setChaptersVersion` (lógica local; não passa por hook de linha).

---

## GET `/api/v1/books/:id` — Detalhe do livro (recuperação de conflito)

**Sem alteração — reusado.**

- **200 OK** + `Cache-Control: no-store`
- Body: `{ "data": <BookDetail> }` com `chapters[]` e `chaptersVersion`.
- **404** (`BOOK_NOT_FOUND`) quando o livro não existe.

**Consumo**: `useBookDetail.handleChaptersConflict` (agora `async`) chama este GET via `apiFetch` e aplica `{ chapters, status, pdfUrl, chaptersVersion }` ao estado local — substitui `router.refresh()` na recuperação de conflito.

---

## Invariantes do contrato

- Nenhum endpoint novo. Nenhum método HTTP novo. Nenhum status code alterado.
- Envelope de sucesso/erro inalterado (Princípio X). Erros continuam pelo `withApiErrorHandler` + catálogo `errorCodes`.
- `X-Chapters-Version` é **string** (header) e representa um inteiro ≥ 0; ausente quando o livro foi removido.
- Validação Zod das rotas inalterada.
