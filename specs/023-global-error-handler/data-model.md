# Data Model: Global Error Handler

**Branch**: `023-global-error-handler` | **Date**: 2026-05-06

Sem mudanças no schema PostgreSQL nesta feature. As "entidades" abaixo são tipos TypeScript que formam o contrato interno entre catálogo, handler servidor e wrapper cliente.

---

## ErrorCode (union)

Identificador estável de erro consumido por testes e por front-end.

```ts
export type ErrorCode =
  // Plataforma
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR"
  | "INVALID_BODY"
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR"          // client-only sentinel
  // Domain — Studio
  | "STUDIO_NOT_FOUND"
  | "STUDIO_REFERENCE_INVALID"
  | "STUDIO_HAS_ACTIVE_BOOKS"
  // Domain — Book
  | "BOOK_NOT_FOUND"
  | "TITLE_ALREADY_IN_USE"
  | "INLINE_STUDIO_INVALID"
  | "BOOK_PAID_PRICE_LOCKED"
  | "BOOK_PAID_STUDIO_LOCKED"
  | "BOOK_CANNOT_REDUCE_CHAPTERS"
  // Domain — Chapter
  | "CHAPTER_NOT_FOUND"
  | "CHAPTER_NUMBER_ALREADY_IN_USE"
  | "CHAPTER_PAID_LOCKED"
  | "CHAPTER_INVALID_TRANSITION"
  | "CHAPTER_NARRATOR_REQUIRED"
  | "CHAPTER_EDITOR_OR_SECONDS_REQUIRED"
  | "CHAPTER_REVERSION_CONFIRMATION_REQUIRED"
  | "CHAPTERS_NOT_IN_BOOK"
  // Domain — Narrator
  | "NARRATOR_NOT_FOUND"
  | "NARRATOR_REFERENCE_INVALID"
  | "NAME_ALREADY_IN_USE"        // shared by Narrator/Studio
  | "NARRATOR_LINKED_TO_ACTIVE_CHAPTERS"
  // Domain — Editor
  | "EDITOR_NOT_FOUND"
  | "EDITOR_REFERENCE_INVALID"
  | "EMAIL_ALREADY_IN_USE"
  | "EDITOR_LINKED_TO_ACTIVE_CHAPTERS";
```

**Validation rules**:
- `UPPER_SNAKE_CASE` apenas (lint check via teste regex em `error-codes.spec.ts`).
- Sem prefixo de namespace (ex.: nada de `BOOK.NOT_FOUND`).
- Cada `code` aparece **uma única vez** na união.

---

## ErrorCatalogEntry

Entrada única no catálogo compartilhado.

```ts
export interface ErrorCatalogEntry {
  readonly status: number;       // 0 para client-only (NETWORK_ERROR), 4xx/5xx caso contrário
  readonly message: string;      // PT-BR, user-facing
  readonly variant?: "error" | "warning";  // toast variant (default: error)
}

export const errorCodes: Readonly<Record<ErrorCode, ErrorCatalogEntry>> = {
  UNAUTHORIZED:               { status: 401, message: "Sua sessão expirou. Faça login novamente.", variant: "warning" },
  VALIDATION_ERROR:           { status: 422, message: "Os dados enviados são inválidos." },
  INVALID_BODY:               { status: 422, message: "Os dados enviados são inválidos." },
  INTERNAL_ERROR:             { status: 500, message: "Algo deu errado. Tente novamente em instantes." },
  NETWORK_ERROR:              { status: 0,   message: "Verifique sua conexão e tente novamente." },
  STUDIO_NOT_FOUND:           { status: 404, message: "Estúdio não encontrado." },
  STUDIO_REFERENCE_INVALID:   { status: 422, message: "O estúdio selecionado não existe ou está arquivado." },
  STUDIO_HAS_ACTIVE_BOOKS:    { status: 409, message: "Este estúdio possui livros com capítulos ativos e não pode ser excluído.", variant: "warning" },
  BOOK_NOT_FOUND:             { status: 404, message: "Livro não encontrado." },
  TITLE_ALREADY_IN_USE:       { status: 409, message: "Já existe um livro com este título neste estúdio." },
  INLINE_STUDIO_INVALID:      { status: 422, message: "Os dados do novo estúdio são inválidos." },
  BOOK_PAID_PRICE_LOCKED:     { status: 409, message: "Este livro já possui um capítulo pago — o preço por hora não pode ser alterado." },
  BOOK_PAID_STUDIO_LOCKED:    { status: 409, message: "Este livro já possui um capítulo pago — o estúdio não pode ser alterado." },
  BOOK_CANNOT_REDUCE_CHAPTERS:{ status: 422, message: "Não é possível reduzir o número de capítulos abaixo do total atual." },
  CHAPTER_NOT_FOUND:          { status: 404, message: "Capítulo não encontrado." },
  CHAPTER_NUMBER_ALREADY_IN_USE: { status: 409, message: "Já existe um capítulo com esse número neste livro." },
  CHAPTER_PAID_LOCKED:        { status: 409, message: "Este capítulo já está pago — narrador, editor e duração não podem ser alterados." },
  CHAPTER_INVALID_TRANSITION: { status: 422, message: "Transição de status não permitida para este capítulo." },
  CHAPTER_NARRATOR_REQUIRED:  { status: 422, message: "É preciso atribuir um narrador antes de iniciar a edição." },
  CHAPTER_EDITOR_OR_SECONDS_REQUIRED: { status: 422, message: "Editor e duração editada (acima de zero) são necessários para enviar para revisão." },
  CHAPTER_REVERSION_CONFIRMATION_REQUIRED: { status: 422, message: "Reverter de pago para concluído exige confirmação explícita." },
  CHAPTERS_NOT_IN_BOOK:       { status: 422, message: "Um ou mais capítulos não pertencem a este livro." },
  NARRATOR_NOT_FOUND:         { status: 404, message: "Narrador não encontrado." },
  NARRATOR_REFERENCE_INVALID: { status: 422, message: "O narrador selecionado não existe ou está arquivado." },
  NAME_ALREADY_IN_USE:        { status: 409, message: "Já existe um cadastro com esse nome." },
  NARRATOR_LINKED_TO_ACTIVE_CHAPTERS: { status: 409, message: "Este narrador está vinculado a capítulos ativos e não pode ser excluído.", variant: "warning" },
  EDITOR_NOT_FOUND:           { status: 404, message: "Editor não encontrado." },
  EDITOR_REFERENCE_INVALID:   { status: 422, message: "O editor selecionado não existe ou está arquivado." },
  EMAIL_ALREADY_IN_USE:       { status: 409, message: "Já existe um cadastro com esse e-mail." },
  EDITOR_LINKED_TO_ACTIVE_CHAPTERS: { status: 409, message: "Este editor está vinculado a capítulos ativos e não pode ser excluído.", variant: "warning" },
};
```

**Validation rules** (testadas em `error-codes.spec.ts`):
- Toda chave em `errorCodes` é um `ErrorCode` válido (exhaustiveness via `Record<ErrorCode, …>`).
- `message` não-vazia, sem `{`, `${`, ou IDs/UUIDs (regex anti-leak).
- `status` ∈ `{0, 401, 404, 409, 422, 500}` para esta feature.
- `variant` ∈ `{undefined, "error", "warning"}`.

---

## ErrorRegistryEntry (server-side)

Liga uma classe de Error de domínio a um `code` do catálogo.

```ts
export interface ErrorRegistryEntry {
  readonly errorClass: new (...args: never[]) => Error;
  readonly code: ErrorCode;
  readonly extractDetails?: (error: Error) => unknown;
}

export const errorRegistry: ReadonlyArray<ErrorRegistryEntry> = [
  // Studio
  { errorClass: StudioNotFoundError,                  code: "STUDIO_NOT_FOUND" },
  { errorClass: StudioNameAlreadyInUseError,          code: "NAME_ALREADY_IN_USE" },
  { errorClass: StudioHasActiveBooksError,            code: "STUDIO_HAS_ACTIVE_BOOKS",
    extractDetails: (e) => ({ books: (e as StudioHasActiveBooksError).books }) },
  // Book
  { errorClass: BookNotFoundError,                    code: "BOOK_NOT_FOUND" },
  { errorClass: BookTitleAlreadyInUseError,           code: "TITLE_ALREADY_IN_USE" },
  { errorClass: BookStudioNotFoundError,              code: "STUDIO_REFERENCE_INVALID" },
  { errorClass: BookInlineStudioInvalidError,         code: "INLINE_STUDIO_INVALID" },
  { errorClass: BookPaidPriceLockedError,             code: "BOOK_PAID_PRICE_LOCKED" },
  { errorClass: BookPaidStudioLockedError,            code: "BOOK_PAID_STUDIO_LOCKED" },
  { errorClass: BookCannotReduceChaptersError,        code: "BOOK_CANNOT_REDUCE_CHAPTERS" },
  // Chapter
  { errorClass: ChapterNotFoundError,                 code: "CHAPTER_NOT_FOUND" },
  { errorClass: ChapterNumberAlreadyInUseError,       code: "CHAPTER_NUMBER_ALREADY_IN_USE" },
  { errorClass: ChapterPaidLockedError,               code: "CHAPTER_PAID_LOCKED" },
  { errorClass: ChapterInvalidTransitionError,        code: "CHAPTER_INVALID_TRANSITION" },
  { errorClass: ChapterNarratorRequiredError,         code: "CHAPTER_NARRATOR_REQUIRED" },
  { errorClass: ChapterEditorOrSecondsRequiredError,  code: "CHAPTER_EDITOR_OR_SECONDS_REQUIRED" },
  { errorClass: ChapterReversionConfirmationRequiredError, code: "CHAPTER_REVERSION_CONFIRMATION_REQUIRED" },
  { errorClass: ChaptersNotInBookError,               code: "CHAPTERS_NOT_IN_BOOK" },
  // Narrator
  { errorClass: NarratorNotFoundError,                code: "NARRATOR_NOT_FOUND" },
  { errorClass: NarratorNameAlreadyInUseError,        code: "NAME_ALREADY_IN_USE" },
  { errorClass: NarratorLinkedToActiveChaptersError,  code: "NARRATOR_LINKED_TO_ACTIVE_CHAPTERS",
    extractDetails: (e) => ({ books: (e as NarratorLinkedToActiveChaptersError).books }) },
  // Editor
  { errorClass: EditorNotFoundError,                  code: "EDITOR_NOT_FOUND" },
  { errorClass: EditorNameAlreadyInUseError,          code: "NAME_ALREADY_IN_USE" },
  { errorClass: EditorEmailAlreadyInUseError,         code: "EMAIL_ALREADY_IN_USE" },
  { errorClass: EditorLinkedToActiveChaptersError,    code: "EDITOR_LINKED_TO_ACTIVE_CHAPTERS",
    extractDetails: (e) => ({ books: (e as EditorLinkedToActiveChaptersError).books }) },
];
```

**Validation rules** (testadas em `error-registry.spec.ts`):
- Toda classe de Error em `src/lib/errors/*-errors.ts` aparece **exatamente uma vez** (verificado via inspeção de export).
- Todo `code` referenciado existe em `errorCodes` (FR-012a).
- Para uma mesma `errorClass`, há no máximo uma entrada no registry.
- Diferentes classes podem mapear para o mesmo `code` quando o domínio compartilha semântica (ex.: `NAME_ALREADY_IN_USE` para Narrator, Editor e Studio).

---

## ApiErrorBody (envelope da resposta)

Mantém-se inalterado em relação ao código existente em `src/lib/api/error-response.ts`:

```ts
export interface ApiErrorDetail {
  readonly field: string;
  readonly message: string;
}

export interface ApiErrorBody {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly details?: ReadonlyArray<ApiErrorDetail> | Record<string, unknown>;
  };
}
```

Nota: `details` aceita tanto `ApiErrorDetail[]` (validação Zod) quanto `Record<string, unknown>` arbitrário (ex.: `{ books: [...] }` em `STUDIO_HAS_ACTIVE_BOOKS`). O cliente discrimina por `code`.

---

## ApiResult<T> (envelope do cliente)

Tipo discriminado retornado por `apiFetch<T>`:

```ts
export type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly kind: "session-expired" }
  | { readonly ok: false; readonly kind: "field-errors"; readonly fields: Readonly<Record<string, string>> }
  | { readonly ok: false; readonly kind: "api-error"; readonly code: ErrorCode; readonly details?: unknown }
  | { readonly ok: false; readonly kind: "network" };
```

**Discriminação**:
- `ok: true` → `data: T` parsed do JSON (ou `null` para 204).
- `ok: false`, `kind: "session-expired"` → toast + redirect já disparados; hook só aborta seu fluxo.
- `ok: false`, `kind: "field-errors"` → `fields` é `Record<fieldName, message>` pronto para `form.setError`.
- `ok: false`, `kind: "api-error"` → toast já disparado (a menos que `suppressToastFor` cobrisse o `code`); hook recebe `code` e `details` para UI customizada opcional.
- `ok: false`, `kind: "network"` → toast já disparado.

---

## DomainError (sentinel opcional)

Para reduzir a necessidade de toda nova classe ser registrada manualmente, esta feature **pode** introduzir uma classe base:

```ts
export abstract class DomainError extends Error {
  abstract readonly code: ErrorCode;
}
```

Quando adotada, classes de domínio extendem `DomainError` e o handler global pode usar `instanceof DomainError` + `error.code` antes de cair na busca por `errorRegistry`. **Mantemos esta opção fora do escopo obrigatório da feature** para não exigir mudança em todas as classes de uma vez; a escolha entre "DomainError + code" vs "registry-only" pode ser tomada na fase de implementação. O contrato público (`ApiErrorBody`, `ErrorCode`) não muda nos dois caminhos.

---

## State Transitions

N/A — não há entidade com ciclo de vida nesta feature; tudo é dado puro (catálogo + tipos discriminados).

---

## Relationships

```text
ErrorClass (src/lib/errors/*-errors.ts)
   │
   │ 1..1 (registry mapping)
   ▼
ErrorRegistryEntry { errorClass, code, extractDetails? }
   │
   │ N..1 (catalog lookup by code)
   ▼
ErrorCatalogEntry { status, message, variant? }   ◄────── shared module
   ▲                                                       (server + client)
   │ N..1 (catalog lookup by code)                                │
   │                                                              │
ApiResult<T> (client)  ◄──── apiFetch<T>(url) ◄──── HTTP response │
                                                       (envelope) │
                                            ◄──── withApiErrorHandler ──────┘
```
