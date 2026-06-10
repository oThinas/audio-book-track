---
description: "Task list for book detail refresh resilience + detail loading skeleton"
---

# Tasks: Resiliência de Refresh no Detalhe do Livro + Skeleton de Carregamento do Detalhe

**Input**: Design documents from `/specs/032-book-detail-refresh-resilience/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: INCLUÍDOS — o projeto exige TDD (Constituição, Princípio V). Cada bloco de implementação é precedido por seus testes (RED antes de GREEN).

**Organization**: Tarefas agrupadas por user story (P1 → P2 → P3), cada uma independentemente testável.

> ⚠️ **Governança**: esta feature toca os fluxos de capítulo (coração do domínio). **Revisão dupla obrigatória** antes do merge (Constituição, Governance).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1, US2, US3 (mapeia para as histórias do spec.md)
- Caminhos de arquivo exatos incluídos em cada tarefa

## Path Conventions

Projeto web Next.js de projeto único: produção em `src/`, testes em `__tests__/{unit,integration,e2e}/`. Caminhos confirmados por leitura do código existente.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparação de referência (sem inicialização de projeto — o projeto já existe).

- [X] T001 [P] Revisar as decisões D1–D6 em `specs/032-book-detail-refresh-resilience/research.md` e o commit `d4154de` (fonte de `loading.tsx` + teste a restaurar); consultar `design.pen` via Pencil MCP para a silhueta do detalhe (referência da US2/031). Confirmar que nenhuma dependência nova é necessária.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: —

**Sem tarefas foundational.** As três histórias são independentes: nenhuma cria schema, migration ou módulo compartilhado novo. Elas compartilham apenas `src/components/features/books/hooks/use-book-detail.ts` e `src/components/features/books/book-detail-client.tsx`, coordenados pela ordem de prioridade (P1 → P2 → P3), não por bloqueio. Implementação das histórias pode começar imediatamente após o Setup.

---

## Phase 3: User Story 1 - Capítulo recém-criado aparece imediatamente e de forma confiável (Priority: P1) 🎯 MVP

**Goal**: Criação otimista de capítulo — o capítulo aparece na lista assim que o servidor confirma (usando o `chapter` já devolvido pelo POST), sem depender do `router.refresh()`. Remove a raiz do bug (#86151) e habilita restaurar o `loading.tsx` com segurança.

**Independent Test**: Abrir o detalhe de um livro com rede lenta simulada, adicionar um capítulo e verificar que ele entra na lista na posição correta assim que o POST responde (201), sem aguardar refresh e sem recarregar.

### Tests for User Story 1 (TDD — escrever primeiro, devem FALHAR) ⚠️

- [X] T002 [P] [US1] Estender `__tests__/unit/components/features/chapters/hooks/use-add-chapter.spec.tsx`: (a) ao receber `201`, `onCreated` é chamado com `{ chapter, bookStatus, chaptersVersion }`, onde `chapter` vem de `result.data.data.chapter`; (b) **caminho de erro** (FR-011 / US1 cenário 3): em `409` (`BOOK_CHAPTERS_VERSION_CONFLICT`) ou `422`, `onCreated` **NÃO** é chamado (nada é inserido otimisticamente) — `onConflict` é chamado apenas no `409`. RED.
- [X] T003 [P] [US1] Estender `__tests__/unit/components/features/books/use-book-detail.spec.ts`: `handleChapterCreated` insere o capítulo em `state.chapters` no índice `chapter.position`, re-densifica posições `0..N-1`, aplica `bookStatus` e `chaptersVersion`. Cobrir os três casos de posição (`end`, `start`, `after`). RED.

### Implementation for User Story 1

- [X] T004 [US1] Em `src/components/features/chapters/hooks/use-add-chapter.ts`: estender `CreatedChapter` e a assinatura de `onCreated` (`UseAddChapterArgs`) para incluir o capítulo criado; em `onSubmit`, repassar `result.data.data.chapter` (+ `bookStatus` + `chaptersVersion`) no `onCreated`. GREEN para T002. (depende de T002)
- [X] T005 [US1] Em `src/components/features/books/hooks/use-book-detail.ts`: reescrever `handleChapterCreated({ chapter, bookStatus, chaptersVersion })` para mapear o capítulo a `ChapterRowData` (`status: "pending"`, `narrator: null`, `editor: null`, `editedSeconds: 0`, `deadline: null`), inseri-lo no índice `chapter.position`, aplicar `densifyPositions` de `@/lib/domain/normalize-positions`, setar `status` e `chaptersVersion`; manter `router.refresh()` apenas como re-sync. GREEN para T003. (depende de T004)
- [X] T006 [US1] Em `src/components/features/books/book-detail-client.tsx`: ajustar o wiring de `onCreated` do `AddChapterDialog` para a nova assinatura (capítulo incluído). (depende de T005)

**Checkpoint**: US1 funcional e testável isoladamente — capítulo criado aparece imediatamente, sem depender de refresh (MVP demonstrável).

---

## Phase 4: User Story 2 - Feedback de carregamento ao abrir o detalhe do livro (Priority: P2)

**Goal**: Restaurar o `loading.tsx` do detalhe (silhueta estruturada + anúncio acessível) e ajustar os 2 specs E2E afetados pelo streaming. Fecha a cobertura de estados de carregamento iniciada na 031.

**Independent Test**: Navegar de `/books` para `/books/[id]` com rede lenta simulada e ver a silhueta (3 barras de cabeçalho + bloco de capítulos) antes do conteúdo real, com `role="status"` único. Gate de aceite (com US1): `chapter-reorder-then-add` verde 10× com o `loading.tsx` presente.

### Tests for User Story 2 (TDD — escrever primeiro, devem FALHAR) ⚠️

- [X] T007 [P] [US2] Restaurar o describe `"/books/[id] loading state"` em `__tests__/unit/app/route-loading-states.spec.tsx` (de `d4154de`): sem heading textual; exatamente um `role="status"`; exatamente um `data-testid="page-loading-skeleton"` com `aria-hidden="true"`; 3 barras de skeleton `aria-hidden` no cabeçalho. RED.

### Implementation for User Story 2

- [X] T008 [US2] Restaurar `src/app/(authenticated)/books/[id]/loading.tsx` (de `d4154de`): `<PageContainer>` + 3 `Skeleton aria-hidden` no cabeçalho (`h-9 w-64`, `h-5 w-48`, `h-5 max-w-md`) + 1 `Skeleton aria-hidden data-testid="page-loading-skeleton"` (`h-96 w-full`) + `<LoadingStatus />`. Server Component (sem `use client`). GREEN para T007. (depende de T007)
- [X] T009 [P] [US2] Ajustar `__tests__/e2e/books-detail.spec.ts` (teste "returns 404 page for unknown book id"): sob streaming o `notFound()` mid-stream responde HTTP 200; substituir `expect(response?.status()).toBe(404)` por `await expect(page.getByTestId("not-found-message")).toBeVisible()` e renomear o título do teste (ex.: "renders the not-found page for unknown book id").
- [X] T010 [P] [US2] Ajustar `__tests__/e2e/chapters-table-scroll.spec.ts`: antes de medir `clientHeight`/`scrollHeight`/`boundingBox`, aguardar `await expect(page.getByTestId("chapter-row-…").first()).toBeVisible()` (conteúdo entra no DOM oculto antes do swap do Suspense).
- [X] T011 [US2] Rodar `__tests__/e2e/chapter-reorder-then-add.spec.ts` em 10 execuções consecutivas COM o `loading.tsx` presente e confirmar 10/10 verdes (SC-001). Comando: `bun run test:e2e -- __tests__/e2e/chapter-reorder-then-add.spec.ts --repeat-each=10` (os args após `--` são repassados ao Playwright; mantém-se o script do `package.json` conforme Princípio XVI). Alternativa equivalente: laço de shell chamando `bun run test:e2e -- __tests__/e2e/chapter-reorder-then-add.spec.ts` 10×. **Observação**: o bug reproduz sem throttling artificial (era 0/4); a repetição 10× é o método de detecção da intermitência — não há simulação de rede lenta neste gate. (depende de T006 + T008)

**Checkpoint**: US2 funcional — nenhuma rota autenticada exibe tela em branco (SC-003); o cenário que travava (`reorder → add`) é estável com o skeleton presente.

---

## Phase 5: User Story 3 - Re-sincronização confiável das demais mutações e da recuperação de conflito (Priority: P3)

**Goal**: Propagar `chaptersVersion` em edit/delete/bulk-delete (PATCH `meta.chaptersVersion`; DELETE/bulk-delete header `X-Chapters-Version`, `204` mantido) e migrar `handleChaptersConflict` para `GET /books/:id`, eliminando a última dependência do `router.refresh()` no caminho crítico.

**Independent Test**: Editar/excluir um capítulo com rede lenta e confirmar que a operação seguinte não dispara conflito de versão espúrio (SC-005); forçar conflito e verificar re-sync sem recarregamento manual.

### Tests for User Story 3 (TDD — escrever primeiro, devem FALHAR) ⚠️

- [X] T012 [P] [US3] Estender `__tests__/integration/chapter-update.spec.ts` (`handleChapterUpdate`, DB real): a resposta PATCH inclui `meta.chaptersVersion` igual à versão bumpada pela mutação. RED.
- [X] T013 [P] [US3] Estender `__tests__/integration/chapter-delete.spec.ts` (`handleChapterDelete`): a resposta `204` inclui header `X-Chapters-Version` quando o livro NÃO é deletado; ausente quando `X-Book-Deleted` (último capítulo). RED.
- [X] T014 [P] [US3] Estender `__tests__/integration/chapter-bulk-delete.spec.ts` (`handleChaptersBulkDelete`): a resposta `204` inclui header `X-Chapters-Version` quando o livro NÃO é deletado. RED.
- [X] T015 [P] [US3] Criar `__tests__/unit/components/features/chapters/hooks/use-chapter-row-edit.spec.tsx`: `persist` lê `meta.chaptersVersion` e chama `onSaved(updated, bookStatus, chaptersVersion)`. RED.
- [X] T016 [P] [US3] Criar `__tests__/unit/components/features/chapters/hooks/use-delete-chapter.spec.tsx`: `handleDelete` lê o header `X-Chapters-Version` e chama `onDeleted(chapterId, bookDeleted, chaptersVersion)`. RED.
- [X] T017 [P] [US3] Estender `__tests__/unit/components/features/books/use-book-detail.spec.ts`: `handleBulkDeleteConfirm` lê `X-Chapters-Version` e aplica; `handleChaptersConflict` (async) faz `GET /api/v1/books/:id` (mock `apiFetch`) e aplica `{ chapters, status, pdfUrl, chaptersVersion }`. (Token de edit/delete é coberto por T015/T016 nos hooks de linha.) RED.

### Implementation for User Story 3

- [X] T018 [US3] Em `src/lib/services/chapter-service.ts`: adicionar `chaptersVersion` a `UpdateChapterResult`, `DeleteChapterResult` e `BulkDeleteChaptersResult` (valor vem de `recomputeBookStatusAndBumpVersion`; `null` quando `bookDeleted`). Pré-requisito necessário (mas não suficiente) para T012–T014 — esses testes só ficam verdes após a serialização nas rotas (T019/T020). (depende de T012, T013, T014)
- [X] T019 [P] [US3] Em `src/app/api/v1/chapters/[id]/route.ts`: PATCH adiciona `meta.chaptersVersion`; DELETE adiciona header `X-Chapters-Version` quando `!bookDeleted`. GREEN para T012/T013. (depende de T018)
- [X] T020 [P] [US3] Em `src/app/api/v1/books/[id]/chapters/bulk-delete/route.ts`: adicionar header `X-Chapters-Version` quando `!bookDeleted`. GREEN para T014. (depende de T018)
- [X] T021 [P] [US3] Em `src/components/features/chapters/hooks/use-chapter-row-edit.ts`: tipar `meta.chaptersVersion` na resposta; re-sincronizar o token via novo callback `onVersionChange` (canal `onChaptersVersionChange` existente). `onSaved` permanece inalterado. GREEN para T015. (depende de T019)
- [X] T022 [P] [US3] Em `src/components/features/chapters/hooks/use-delete-chapter.ts`: ler header `X-Chapters-Version`; re-sincronizar via novo callback `onVersionChange`. `onDeleted` permanece inalterado. GREEN para T016. (depende de T019)
- [X] T023 [US3] Em `src/components/features/books/hooks/use-book-detail.ts`: `handleBulkDeleteConfirm` lê `X-Chapters-Version` e aplica `setChaptersVersion`; `handleChaptersConflict` async → `GET /api/v1/books/:id` via `apiFetch`, aplicando `{ chapters, status, pdfUrl, chaptersVersion }` ao estado local (sem swallow). `handleChapterSaved`/`handleChapterDeleted` inalterados — token re-sincroniza pelo canal `onChaptersVersionChange` dos hooks de linha. GREEN para T017. (depende de T021, T022)
- [X] T024 [US3] Threading de `onChaptersVersionChange` do `ChaptersTable` até os hooks de linha: `chapters-table.tsx` → `chapter-row.tsx` → `useDeleteChapter`; `chapter-row.tsx` → `chapter-row-edit-mode.tsx` → `useChapterRowEdit`. `book-detail-client.tsx` já provê o canal via `handleChaptersVersionBump` (sem mudança nele). (depende de T023)

**Checkpoint**: US3 funcional — edit/delete/bulk-delete re-sincronizam o token sem depender do refresh; recuperação de conflito via GET.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Encerramento e verificação final.

- [X] T025 [P] Atualizar `futuras-features.md`: remover/arquivar a seção "Resiliência de refresh no detalhe do livro + loading.tsx do detalhe (US2 da 031)" (implementada nesta feature 032).
- [X] T026 Self-review contra o checklist da Constituição (Princípios I–XVI), com atenção especial à **revisão dupla** dos fluxos de capítulo (Princípio II / Governance) e aos anti-padrões frontend (Princípio XII: nada de `fetch`/`router.refresh` em componente client; sem `toast.success`).
- [X] T027 Fase final de verificação (Princípio XVI), em ordem: `bun run lint` (zero erros/warnings) → `bun run test:unit` → `bun run test:integration` → `bun run test:e2e` → `bun run build`. Todos verdes antes do PR.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: vazia — não bloqueia.
- **User Stories (Phase 3–5)**: dependem apenas do Setup. Recomenda-se a ordem de prioridade P1 → P2 → P3 (US1 habilita restaurar o `loading.tsx` da US2 com segurança; US3 é blindagem independente).
- **Polish (Phase 6)**: depois das histórias desejadas.

### User Story Dependencies

- **US1 (P1)**: independente. MVP. Usa o `chapter` já devolvido pelo POST — sem mudança de backend.
- **US2 (P2)**: independente para testar a silhueta; o **gate de aceite** (T011, `reorder → add` 10×) requer **US1** concluída (sem ela, o capítulo não aparece com o `loading.tsx` presente).
- **US3 (P3)**: independente (token em edit/delete/bulk-delete + recuperação de conflito). Não é exigida pelo gate de aceite da US2.

### Acoplamento por arquivo (coordenar em ordem)

- `use-book-detail.ts`: tocado por T005 (US1) e T023 (US3) — fases distintas, sequenciais.
- `book-detail-client.tsx`: tocado por T006 (US1) e T024 (US3) — fases distintas, sequenciais.
- `use-book-detail.spec.ts`: tocado por T003 (US1) e T017 (US3) — describes distintos, fases distintas.

### Within Each User Story

- Testes (RED) antes da implementação (GREEN).
- Service antes das rotas; rotas antes dos hooks que as consomem.
- Implementação antes do ajuste de wiring no client.

### Parallel Opportunities

- **US1**: T002 e T003 em paralelo (arquivos diferentes).
- **US2**: T009 e T010 em paralelo (specs E2E diferentes); T007 em paralelo com eles.
- **US3 (testes)**: T012, T013, T014, T015, T016, T017 todos em paralelo (arquivos diferentes).
- **US3 (impl)**: após T018 → T019 e T020 em paralelo; depois T021 e T022 em paralelo; T023 e T024 sequenciais.

---

## Parallel Example: User Story 3 (testes RED)

```bash
# Disparar todos os testes da US3 juntos (arquivos distintos):
Task: "Estender chapter-update.spec.ts: PATCH meta.chaptersVersion"          # T012
Task: "Estender chapter-delete.spec.ts: header X-Chapters-Version"            # T013
Task: "Estender chapter-bulk-delete.spec.ts: header X-Chapters-Version"       # T014
Task: "Criar use-chapter-row-edit.spec.tsx: lê meta.chaptersVersion"          # T015
Task: "Criar use-delete-chapter.spec.tsx: lê header X-Chapters-Version"       # T016
Task: "Estender use-book-detail.spec.ts: bump local + resync por GET"         # T017
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (Setup) → Phase 3 (US1).
2. **PARAR e VALIDAR**: capítulo criado aparece imediatamente em rede lenta, sem refresh. Demo do MVP.

### Incremental Delivery

1. US1 → testar isolada (criação otimista resiliente).
2. US2 → restaurar `loading.tsx`; rodar o gate `reorder → add` 10×.
3. US3 → token em edit/delete/bulk-delete + recuperação de conflito.
4. **Recomendação de merge**: como a feature é coesa e toca fluxos de capítulo (revisão dupla), entregar US1 + US2 + US3 num único PR; a fase final de verificação (T027) roda a suíte completa após as três.

### Notas

- **Não** trocar DELETE para `200` — manter `204` + header `X-Chapters-Version` (Princípio X).
- **Não** "consertar" o capítulo otimista oculto pelo filtro foco-semana (é `pending`/sem deadline → comportamento correto).
- Livro deletado (último capítulo não-pago): `chaptersVersion = null`/sem header → redirecionar para `/books` (comportamento existente), sem bump.
- `applyBookUpdate`/`handlePdfUrlChange` mantêm `router.refresh()` (não bumpam `chaptersVersion`; já atualizam estado local) — fora de escopo (YAGNI).
- Commit por tarefa ou grupo lógico (somente quando o usuário solicitar — sem commits automáticos).

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente.
- Verificar que os testes falham (RED) antes de implementar.
- Cada história é independentemente completável e testável.
- Parar em qualquer checkpoint para validar a história isoladamente.
