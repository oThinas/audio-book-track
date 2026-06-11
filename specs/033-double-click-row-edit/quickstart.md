# Quickstart: Double-Click Row Edit

**Feature**: 033-double-click-row-edit | **Date**: 2026-06-10

## O que esta feature faz

Na tabela de capítulos da página de detalhe do livro, **dar duplo-clique em qualquer célula de dado** (Título, Status, Narrador, Editor, Prazo, Horas) coloca a linha em modo edição **e** ativa o controle daquela célula: dropdowns e o seletor de prazo abrem; inputs recebem foco. O lápis continua disponível para teclado/descoberta.

## Verificação manual (dev)

```bash
bun run dev
```

1. Abra `/books/<id>` de um livro com capítulos.
2. **Duplo-clique no badge de Status** de um capítulo → a linha entra em edição e o **dropdown de status abre**.
3. Repita em **Narrador**, **Editor** → o respectivo dropdown abre.
4. **Duplo-clique em Prazo** → o **popover do calendário abre**.
5. **Duplo-clique em Título** ou **Horas** → o input correspondente recebe **foco** (texto não fica selecionado).
6. **Duplo-clique** na alça de arrastar / coluna de Ações → **nada acontece**.
7. Em um capítulo **`paid`**: duplo-clique em **Status** abre o dropdown (reversão); duplo-clique em **Título, Narrador, Editor, Prazo ou Horas** (travados por `PAID_LOCKED_FIELDS`) entra em edição mas **não** ativa o controle (sem foco/abertura).
8. Ative o **modo de seleção em massa** → duplo-clique em células é **no-op**.
9. Use **Tab** até o lápis e **Enter** → entra em edição como antes.

## Verificação automatizada

```bash
# Unit — helper puro (100%) + hook + componente
bun run test:unit __tests__/unit/components/features/chapters/chapter-row-activation.spec.ts
bun run test:unit __tests__/unit/components/features/chapters/use-chapter-row.spec.ts
bun run test:unit __tests__/unit/components/features/chapters/chapter-row.spec.tsx

# E2E — duplo-clique real (abertura/foco)
bun run test:e2e __tests__/e2e/books-detail.spec.ts
```

## Fase final de verificação (antes do PR — Princípio XVI)

```bash
bun run lint           # zero erros e zero warnings
bun run test:unit
bun run test:integration
bun run test:e2e       # afeta fluxos da tabela de capítulos
bun run build          # produção compila
```

## Pontos de atenção na implementação

- **TDD**: comece pelo helper puro `resolveActivation` (RED → GREEN → REFACTOR), depois o hook, depois os componentes, depois E2E.
- **Princípio VII**: `activateField` no hook; mapeamento no helper puro; componentes só renderizam. Nenhum `useEffect` imperativo de foco.
- **`@base-ui/react`**: usar `defaultOpen` nos `Select.Root`/`Popover.Root` (confirmado via Context7). `autoFocus` nos inputs.
- **`paid`**: `resolveActivation` retorna ativação falsa para todos os campos em `PAID_LOCKED_FIELDS` (Título, Narrador, Editor, Prazo, Horas) quando `status === "paid"` — só Status ativa. Deriva de `PAID_LOCKED_FIELDS`, não do `disabled` (parcial) do edit-mode.
- **Supressão de seleção**: `onMouseDown` com `if (e.detail > 1) e.preventDefault()` nas células de dado — não usar `user-select: none` global.
- **Sem deps novas, sem mudança de schema/API/domínio.**
