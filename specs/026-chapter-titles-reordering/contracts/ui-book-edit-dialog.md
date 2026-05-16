# Contract: `<BookEditDialog />` (mudança)

**Type**: UI component (mudança)
**Feature**: 026-chapter-titles-reordering
**File**: `src/components/features/books/book-edit-dialog.tsx`

## Purpose

Diálogo de edição de livro. **Mudança nesta feature**: remoção do campo "Capítulos" e do reduce-hint. O caminho implícito de criação de capítulos (aumentar `numChapters`) deixa de existir.

## Antes desta feature

```
[ Título: _____________________ ]
[ Estúdio: ▼ _________________  ]
[ Preço/hora: R$ _____________  ]
[ Capítulos: __ ]   ← removido
   "Para reduzir, use 'Excluir capítulos'"   ← removido
[ PDF URL: _____________________ ]
```

## Depois desta feature

```
[ Título: _____________________ ]
[ Estúdio: ▼ _________________  ]
[ Preço/hora: R$ _____________  ]
[ PDF URL: _____________________ ]
```

## Code-level changes

- Remover bloco `<Field>` em torno do `<Controller name="numChapters" .../>` (linhas ~282-316 atualmente).
- Remover import `ChapterCountInput` se ficar órfão (`ChapterCountInput` continua sendo usado no diálogo de **criação**).
- Remover `reduceHint` state e o `<p data-testid="book-edit-chapters-reduce-hint">`.
- Remover `numChapters` de `useEditBookForm.ts` (schema, default, submit payload).

## Testes

- Unit: `use-edit-book-form.spec.tsx` perde casos relacionados a `numChapters`.
- E2E: testes que aumentavam capítulos via "Editar livro" são migrados para o novo fluxo de "+ Adicionar capítulo" na página de detalhe.

## UX consequence

Operador descobre o novo fluxo via botão "+ Adicionar capítulo" na página de detalhe — mais visível e contextual que o campo escondido no diálogo de edição.
