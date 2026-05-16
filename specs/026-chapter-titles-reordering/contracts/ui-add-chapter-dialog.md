# Contract: `<AddChapterDialog />`

**Type**: UI component (novo)
**Feature**: 026-chapter-titles-reordering
**File**: `src/components/features/chapters/add-chapter-dialog.tsx`

## Purpose

Dialog modal para adicionar **um** capítulo a um livro existente. Usado a partir do botão "+ Adicionar capítulo" na página de detalhe (`/books/:id`). Pode também ser embarcado, com pequenas adaptações, na seção "Extras" do diálogo de criação de livro (ver `ui-book-create-extras-section.md`) — mas o componente principal só serve a edição.

## Props

```ts
interface AddChapterDialogProps {
  readonly book: {
    readonly id: string;
    readonly chaptersVersion: number;
  };
  readonly existingChapters: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly position: number;
  }>;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}
```

## Behavior

1. Ao abrir, mostra três seções verticais:
   - **Tipo do capítulo** (radio group):
     - "Capítulo numerado" — pré-preenche `title` com `nextChapterTitle(existingChapters.map(c => c.title))`.
     - "Prólogo" / "Epílogo" / "Apresentação" — pré-preenche `title` com o `defaultTitle` do template.
     - "Personalizado" — revela campo de texto vazio.
   - **Título** (`<Input>` shadcn) — sempre editável após a seleção. Validação inline 1..100 chars.
   - **Posição** (radio group):
     - "No início"
     - "No fim" *(default)*
     - "Depois de…" — revela `<Select>` listando os capítulos existentes ordenados por `position` (rótulo = `title`).
2. Botão **"Adicionar"** habilitado quando título é válido. Chama `useAddChapter()` que dispara `apiFetch` para `POST /books/:bookId/chapters`.
3. Em sucesso: dialog fecha, lista de capítulos atualizada (capítulo novo destacado por 1s via `aria-live` / animação curta).
4. Em conflito 409 (`BOOK_CHAPTERS_VERSION_CONFLICT`): toast PT-BR via `apiFetch` + dialog fecha + a página revalida (refetch) a lista.

## Visual

- Wrapper: `<Dialog>` shadcn padrão.
- Tipografia, espaçamento e cores via tokens (dark mode coberto automaticamente).
- Largura preferida: 420px desktop, fullscreen mobile (`max-w-md sm:max-w-lg`).
- Drag handle, ícones via `lucide-react` (`Plus`, `ChevronDown`).

## Lógica em hook

Toda lógica (estado do formulário com `react-hook-form` + Zod, mutação, validação) reside em `src/components/features/chapters/hooks/use-add-chapter.ts`. O componente apenas renderiza JSX e chama o hook (Princípio VII).

## Acessibilidade

- Foco automático no input de título ao abrir.
- Esc fecha o dialog.
- Selects e radios navegáveis por teclado.
- Mensagens de erro associadas via `aria-describedby`.

## Testes

- Unit (`use-add-chapter.spec.tsx`): cobre estado do form, submit OK, submit com 409, submit com 422.
- E2E (`chapter-titles-and-reorder.spec.ts`): "operador adiciona Prólogo no início via dialog".
