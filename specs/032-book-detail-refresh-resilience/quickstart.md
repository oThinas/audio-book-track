# Quickstart: Resiliência de Refresh no Detalhe do Livro + Skeleton do Detalhe

**Feature**: 032-book-detail-refresh-resilience | **Date**: 2026-06-10

Guia de orientação para implementar a feature em TDD (Princípio V). Sem schema, sem migration, sem dependência nova. **Revisão dupla obrigatória** (toca fluxos de capítulo — governança).

## Pré-requisitos

- Branch `032-book-detail-refresh-resilience` (já criada).
- Context7 consultado para Next.js (streaming/`loading.tsx`/`notFound`) — já feito na pesquisa; reconsultar ao codar se necessário.
- `design.pen` consultado para a silhueta do detalhe (referência da US2 da 031).

## Ordem sugerida (resiliência primeiro, depois o skeleton)

A ordem reflete a dependência: o `loading.tsx` (US2) só é seguro **depois** da resiliência (US1/US3).

### Fase A — US3 parcial: propagar `chaptersVersion` (backend, habilita o resto)

1. **RED**: integration tests afirmando que PATCH devolve `meta.chaptersVersion`, e que DELETE/bulk-delete devolvem header `X-Chapters-Version` (e que o livro deletado **não** traz o header).
2. **GREEN**:
   - `chapter-service.ts`: adicionar `chaptersVersion` a `UpdateChapterResult`, `DeleteChapterResult`, `BulkDeleteChaptersResult` (valor já vem de `recomputeBookStatusAndBumpVersion`; `null` quando `bookDeleted`).
   - `api/v1/chapters/[id]/route.ts`: PATCH → `meta.chaptersVersion`; DELETE → header `X-Chapters-Version` quando `!bookDeleted`.
   - `api/v1/books/[id]/chapters/bulk-delete/route.ts`: header `X-Chapters-Version` quando `!bookDeleted`.

### Fase B — US1: criação otimista (coração da feature)

3. **RED**: unit tests de `useBookDetail.handleChapterCreated` — dado um capítulo retornado, ele é inserido em `state.chapters` no índice correto, a lista é re-densificada `0..N-1`, `bookStatus` e `chaptersVersion` são aplicados (cobrir inserção em start/end/after). Unit test de `useAddChapter` repassando o `chapter` no `onCreated`.
4. **GREEN**:
   - `use-add-chapter.ts`: estender `CreatedChapter`/`onCreated` para incluir o `chapter`; mapear para `ChapterRowData` (`status: "pending"`, narrator/editor `null`, `editedSeconds: 0`, `deadline: null`).
   - `use-book-detail.ts`: `handleChapterCreated({ chapter, chaptersVersion, bookStatus })` → inserir em `state.chapters` no índice `chapter.position`, aplicar `densifyPositions`, setar status + token; manter `router.refresh()` como re-sync.
   - Ajustar wiring em `book-detail-client.tsx` se a assinatura do callback mudar.

### Fase C — US3 restante: bump local + recuperação de conflito

5. **RED**: unit tests — `handleChapterSaved`/`handleChapterDeleted`/`handleBulkDeleteConfirm` aplicam o novo token; `handleChaptersConflict` faz GET e aplica o detalhe (mockar `apiFetch`).
6. **GREEN**:
   - `use-chapter-row-edit.ts`: ler `meta.chaptersVersion`; `onSaved(updated, bookStatus, chaptersVersion)`.
   - `use-delete-chapter.ts`: ler header `X-Chapters-Version`; `onDeleted(chapterId, bookDeleted, chaptersVersion)`.
   - `use-book-detail.ts`: bump de token em saved/deleted/bulk; `handleChaptersConflict` async → `GET /books/:id` via `apiFetch` → aplicar `{ chapters, status, pdfUrl, chaptersVersion }`. Manter `router.refresh()` apenas como re-sync onde fizer sentido.

### Fase D — US2: restaurar o `loading.tsx`

7. **RED**: restaurar o describe `"/books/[id] loading state"` em `__tests__/unit/app/route-loading-states.spec.tsx` (de `d4154de`).
8. **GREEN**: restaurar `src/app/(authenticated)/books/[id]/loading.tsx` (de `d4154de`).

### Fase E — E2E (FR-010 + aceite)

9. Ajustar `books-detail.spec.ts` (404 → `not-found-message` visível; sob streaming o status é HTTP 200).
10. Ajustar `chapters-table-scroll.spec.ts` (aguardar visibilidade da 1ª linha antes de medir).
11. Rodar `chapter-reorder-then-add.spec.ts` **10× consecutivas COM o `loading.tsx` presente** (SC-001). Deve ficar verde em todas.

## Verificação final (Princípio XVI — antes do PR)

```bash
bun run lint                 # zero erros e warnings
bun run test:unit
bun run test:integration
bun run test:e2e             # inclui o aceite (repetir o spec de aceite 10×)
bun run build
```

## Mapeamento Story → Critério de aceite

| Story | Evidência |
|---|---|
| US1 (P1) | `chapter-reorder-then-add.spec.ts:84` (capítulo criado visível) verde com `loading.tsx`; unit de `handleChapterCreated`. |
| US2 (P2) | `loading.tsx` restaurado; unit `"/books/[id] loading state"`; nenhuma rota autenticada com tela em branco (SC-003). |
| US3 (P3) | integration (token nos contratos); unit (bump local + resync por GET); SC-005 (sem conflito espúrio). |

## Armadilhas conhecidas

- **Filtro foco-semana**: o capítulo otimista é `pending` sem deadline → fica oculto se o filtro de foco-semana estiver ativo. Comportamento correto (espelha o servidor) — não "consertar".
- **Livro deletado** (último capítulo não-pago removido): `chaptersVersion = null`/sem header; redirecionar para `/books` (comportamento existente) — não tentar bump.
- **`handleChaptersConflict` async**: não engolir erro do GET; `apiFetch` já trata (toast/401). Em falha, manter estado anterior.
- **Não trocar DELETE para 200**: manter `204` + header (Princípio X).
