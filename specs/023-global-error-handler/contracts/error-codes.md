# Contract: Error Code Catalog

**Branch**: `023-global-error-handler` | **Status**: stable

Catálogo exaustivo de `ErrorCode` exportado por `src/lib/api/error-codes.ts`. Importado por servidor (registry + handler) **e** cliente (`apiFetch`).

## Plataforma

| Code | Status | Variant | Mensagem PT-BR |
|------|--------|---------|----------------|
| `UNAUTHORIZED` | 401 | warning | Sua sessão expirou. Faça login novamente. |
| `VALIDATION_ERROR` | 422 | error | Os dados enviados são inválidos. |
| `INVALID_BODY` | 422 | error | Os dados enviados são inválidos. |
| `INTERNAL_ERROR` | 500 | error | Algo deu errado. Tente novamente em instantes. |
| `NETWORK_ERROR` | 0 (client-only) | error | Verifique sua conexão e tente novamente. |

## Studio

| Code | Status | Variant | Mensagem PT-BR | Origem (Error class) |
|------|--------|---------|----------------|----------------------|
| `STUDIO_NOT_FOUND` | 404 | error | Estúdio não encontrado. | `StudioNotFoundError` |
| `STUDIO_REFERENCE_INVALID` | 422 | error | O estúdio selecionado não existe ou está arquivado. | `StudioReferenceInvalidError` (renomeada a partir de `BookStudioNotFoundError` nesta feature) |
| `STUDIO_HAS_ACTIVE_BOOKS` | 409 | warning | Este estúdio possui livros com capítulos ativos e não pode ser excluído. | `StudioHasActiveBooksError` (`details.books[]`) |

## Book

| Code | Status | Variant | Mensagem PT-BR | Origem |
|------|--------|---------|----------------|--------|
| `BOOK_NOT_FOUND` | 404 | error | Livro não encontrado. | `BookNotFoundError` |
| `TITLE_ALREADY_IN_USE` | 409 | error | Já existe um livro com este título neste estúdio. | `BookTitleAlreadyInUseError` |
| `INLINE_STUDIO_INVALID` | 422 | error | Os dados do novo estúdio são inválidos. | `BookInlineStudioInvalidError` |
| `BOOK_PAID_PRICE_LOCKED` | 409 | error | Este livro já possui um capítulo pago — o preço por hora não pode ser alterado. | `BookPaidPriceLockedError` |
| `BOOK_PAID_STUDIO_LOCKED` | 409 | error | Este livro já possui um capítulo pago — o estúdio não pode ser alterado. | `BookPaidStudioLockedError` |
| `BOOK_CANNOT_REDUCE_CHAPTERS` | 422 | error | Não é possível reduzir o número de capítulos abaixo do total atual. | `BookCannotReduceChaptersError` |

## Chapter

| Code | Status | Variant | Mensagem PT-BR | Origem |
|------|--------|---------|----------------|--------|
| `CHAPTER_NOT_FOUND` | 404 | error | Capítulo não encontrado. | `ChapterNotFoundError` |
| `CHAPTER_NUMBER_ALREADY_IN_USE` | 409 | error | Já existe um capítulo com esse número neste livro. | `ChapterNumberAlreadyInUseError` |
| `CHAPTER_PAID_LOCKED` | 409 | error | Este capítulo já está pago — narrador, editor e duração não podem ser alterados. | `ChapterPaidLockedError` |
| `CHAPTER_INVALID_TRANSITION` | 422 | error | Transição de status não permitida para este capítulo. | `ChapterInvalidTransitionError` |
| `CHAPTER_NARRATOR_REQUIRED` | 422 | error | É preciso atribuir um narrador antes de iniciar a edição. | `ChapterNarratorRequiredError` |
| `CHAPTER_EDITOR_OR_SECONDS_REQUIRED` | 422 | error | Editor e duração editada (acima de zero) são necessários para enviar para revisão. | `ChapterEditorOrSecondsRequiredError` |
| `CHAPTER_REVERSION_CONFIRMATION_REQUIRED` | 422 | error | Reverter de pago para concluído exige confirmação explícita. | `ChapterReversionConfirmationRequiredError` |
| `CHAPTERS_NOT_IN_BOOK` | 422 | error | Um ou mais capítulos não pertencem a este livro. | `ChaptersNotInBookError` |

## Narrator

| Code | Status | Variant | Mensagem PT-BR | Origem |
|------|--------|---------|----------------|--------|
| `NARRATOR_NOT_FOUND` | 404 | error | Narrador não encontrado. | `NarratorNotFoundError` |
| `NARRATOR_REFERENCE_INVALID` | 422 | error | O narrador selecionado não existe ou está arquivado. | (lançado em ChapterService quando `narratorId` não existe) |
| `NAME_ALREADY_IN_USE` | 409 | error | Já existe um cadastro com esse nome. | `NarratorNameAlreadyInUseError`, `EditorNameAlreadyInUseError`, `StudioNameAlreadyInUseError` |
| `NARRATOR_LINKED_TO_ACTIVE_CHAPTERS` | 409 | warning | Este narrador está vinculado a capítulos ativos e não pode ser excluído. | `NarratorLinkedToActiveChaptersError` (`details.books[]`) |

## Editor

| Code | Status | Variant | Mensagem PT-BR | Origem |
|------|--------|---------|----------------|--------|
| `EDITOR_NOT_FOUND` | 404 | error | Editor não encontrado. | `EditorNotFoundError` |
| `EDITOR_REFERENCE_INVALID` | 422 | error | O editor selecionado não existe ou está arquivado. | (lançado em ChapterService quando `editorId` não existe) |
| `EMAIL_ALREADY_IN_USE` | 409 | error | Já existe um cadastro com esse e-mail. | `EditorEmailAlreadyInUseError` |
| `EDITOR_LINKED_TO_ACTIVE_CHAPTERS` | 409 | warning | Este editor está vinculado a capítulos ativos e não pode ser excluído. | `EditorLinkedToActiveChaptersError` (`details.books[]`) |

## Regras gerais

1. **Estabilidade**: Adicionar code ≠ breaking change. Renomear/remover code é breaking change.
2. **Mensagens** ficam em PT-BR e são proibidas de carregar IDs, nomes em inglês de entidade ou interpolação dinâmica. Toda variabilidade vai em `details`.
3. **`status: 0`** é sentinel exclusivo para `NETWORK_ERROR` — usado apenas no cliente; nunca aparece em resposta HTTP.
4. **`variant: warning`** é reservado para situações onde a ação do usuário foi bloqueada por estado legítimo (sessão expirada, recurso com vínculos ativos), não para falhas inesperadas.
5. **Adicionar novo code**: editar `error-codes.ts` (uma linha) + adicionar entrada em `error-registry.ts` se mapeia uma nova `Error` class. Teste `error-registry.spec.ts` falha automaticamente se uma classe nova em `src/lib/errors/*-errors.ts` não tiver entrada.
