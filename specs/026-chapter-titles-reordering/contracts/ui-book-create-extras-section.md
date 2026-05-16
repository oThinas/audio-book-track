# Contract: `<BookExtrasInput />` (criação de livro)

**Type**: UI component (novo)
**Feature**: 026-chapter-titles-reordering
**File**: `src/components/features/books/book-extras-input.tsx`

## Purpose

Seção dentro do `book-create-dialog.tsx` que permite o operador adicionar uma lista de capítulos extras ao livro **antes** do submit. Combina-se com o `<ChapterCountInput>` (que define o número de capítulos numerados).

## Props

```ts
interface BookExtrasInputProps {
  readonly value: ReadonlyArray<BookExtraDraft>;
  readonly onChange: (next: ReadonlyArray<BookExtraDraft>) => void;
  readonly disabled?: boolean;
}

type BookExtraDraft =
  | { id: string; kind: "template"; template: ChapterTemplateKey; position: "start" | "end" }
  | { id: string; kind: "custom";   title: string;                position: "start" | "end" };
```

`id` é cliente-only (UUID gerado pelo navegador) para servir de key em listas; não é enviado ao servidor.

## Behavior

1. Renderiza:
   - Cabeçalho "Capítulos extras (opcional)".
   - Lista vertical de extras já adicionados, cada um mostrando: rótulo (ex.: "Prólogo (no início)") + botão "Editar" + botão "Remover".
   - Botão "+ Adicionar extra" que abre menu com opções:
     - **Prólogo (no início)**, **Apresentação (no início)**, **Epílogo (no fim)** — atalhos de template + posição.
     - **Personalizado…** — abre formulário inline para digitar título + escolher `start` / `end`.
2. Cada item de extra na lista é reordenável **dentro da própria lista** via botões ↑/↓ (sem drag-and-drop nesta seção — pequeno demais para justificar).
3. Validação inline: extras `custom` com título vazio ou > 100 chars bloqueiam o submit do livro.
4. Limite máximo: 20 extras (alinhado com `createBookSchema`).

## State

Estado controlado pelo `useCreateBookForm` (React Hook Form via `Controller`). Sem estado local de domínio neste componente; só estado puramente visual (qual extra está sendo editado inline).

## Visual

- Tokens semânticos para fundo, borda e texto.
- Cada item de extra em uma `<Card>` shadcn de baixa altura (não polui o layout do dialog).
- Botões "+ Adicionar extra" e ícones via `lucide-react` (`Plus`, `Trash`, `Pencil`).

## Hooks consumidos

- `useCreateBookForm` (estendido) — já controla o form do diálogo de criação; passa `value` / `onChange` para esta seção via `Controller`.

## Testes

- Unit (`use-create-book-form.spec.tsx`): aceita extras válidos, rejeita custom inválidos, submete payload no formato `createBookSchema`.
- E2E: criar livro com 5 numerados + Prólogo + Epílogo, verificar ordem na tabela.
