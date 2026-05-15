# Contract: `CHAPTER_TEMPLATES` catálogo

**Type**: Library export (novo)
**Feature**: 026-chapter-titles-reordering
**File**: `src/lib/domain/chapter-templates.ts`

## Shape

```ts
export const CHAPTER_TEMPLATES = {
  prologue:     { label: "Prólogo",      defaultTitle: "Prólogo" },
  epilogue:     { label: "Epílogo",      defaultTitle: "Epílogo" },
  presentation: { label: "Apresentação", defaultTitle: "Apresentação" },
} as const;

export type ChapterTemplateKey = keyof typeof CHAPTER_TEMPLATES;
export type ChapterTemplate = (typeof CHAPTER_TEMPLATES)[ChapterTemplateKey];

export const CHAPTER_TEMPLATE_KEYS: readonly ChapterTemplateKey[] =
  Object.keys(CHAPTER_TEMPLATES) as ChapterTemplateKey[];
```

## Semantics

- Catálogo **fixo** nesta entrega — adicionar template requer mudança de código.
- `label` é o texto exibido no seletor de UI ("Prólogo" no botão).
- `defaultTitle` é o que vira `chapter.title` quando o operador escolhe esse template.
- Nesta entrega, `label === defaultTitle`; campos separados para suportar futura divergência (ex.: template "Dedicatória" com label "Dedicatória" mas default `"Dedicatória do autor"`).

## Server vs. client

- O catálogo é importado tanto em código de servidor (Zod enum de templates, geração de título no `BookService.create`) quanto em código de cliente (botões de seleção, rótulos no dialog).
- O servidor **não** persiste a chave de template — armazena apenas o `title` final no banco. Tracing de "veio de template" é puramente conveniência de UX.

## Consumers

- `src/lib/schemas/book.ts` — `z.enum(CHAPTER_TEMPLATE_KEYS)` no schema de extras.
- `src/lib/services/book-service.ts` — resolve `template → defaultTitle` na criação atômica.
- `src/components/features/chapters/add-chapter-dialog.tsx` — itera `CHAPTER_TEMPLATE_KEYS` para renderizar botões de seleção.
- `src/components/features/books/book-extras-input.tsx` — mesma iteração no diálogo de criação.

## Out of scope

- Catálogo configurável por banco (declarado em Out of Scope da spec).
- Internacionalização (catálogo é PT-BR fixo; sistema é PT-BR).
