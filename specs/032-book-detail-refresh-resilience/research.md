# Research: Resiliência de Refresh no Detalhe do Livro + Skeleton do Detalhe

**Feature**: 032-book-detail-refresh-resilience | **Date**: 2026-06-10

Este documento resolve as decisões de design deixadas em aberto na spec (seção Assumptions) e registra os achados da leitura do código existente que fundamentam o plano. Todas as decisões foram tomadas com base no código real, na constituição e em verificação via Context7.

---

## D1 — Como o capítulo recém-criado aparece sem depender do refresh

**Decisão**: Inserção otimista no estado local a partir da resposta do POST, com re-densificação `0..N-1` no cliente (reuso de `densifyPositions`); `router.refresh()` permanece como re-sync em background.

**Rationale**:
- O POST `/books/:id/chapters` já retorna `201 { data: { chapter, bookStatus, chaptersVersion } }` (ver `src/app/api/v1/books/[id]/chapters/route.ts:33`). O `chapter` traz `id, title, position, status, narratorId, editorId, editedSeconds, deadline`. Tudo que a linha da tabela precisa já está disponível — nenhuma busca extra é necessária.
- O capítulo novo é sempre `status: "pending"`, `narratorId/editorId = null`, `editedSeconds = 0`, `deadline = null`. O mapeamento para `ChapterRowData` é direto.
- O servidor já re-densifica todas as posições (`densifyPositions` em `chapter-service.ts:326`) e devolve a `position` final do capítulo inserido. O cliente reconstrói o mesmo resultado: insere o capítulo no índice `position` e aplica `densifyPositions` (helper puro de `lib/domain/normalize-positions`, seguro no cliente) — DRY com o servidor.
- Alinha o fluxo de criação aos fluxos irmãos (`handleChapterSaved`, `handleChapterDeleted`, `handleBulkDeleteConfirm`, `applyBookUpdate`), que já atualizam `state.chapters` localmente e usam o refresh apenas como re-sync (FR-004).

**Alternativas consideradas**:
- *Buscar o detalhe completo (GET) após criar*: rejeitado — desperdiça um round-trip quando o POST já devolve tudo; mais lento e ainda dependeria de uma resposta de rede para o capítulo aparecer.
- *Manter só o `router.refresh()` (status quo)*: é exatamente a causa do bug — viola FR-003.

---

## D2 — Propagar `chaptersVersion` nos contratos de mutação (edit/delete/bulk-delete)

**Decisão**: Os três contratos passam a expor o novo `chaptersVersion`. **PATCH** o devolve no corpo (`meta.chaptersVersion`). **DELETE** e **bulk-delete** **mantêm `204`** e expõem o token via header **`X-Chapters-Version`** (mesmo padrão do `X-Book-Deleted` já existente).

**Rationale**:
- O valor já é computado em toda mutação: `recomputeBookStatusAndBumpVersion` retorna `{ status, chaptersVersion }` e `create()` já o propaga (`chapter-service.ts:340`). Para `update()`/`delete()`/`bulkDelete()`, basta adicionar o campo aos result types — **zero query nova, zero lógica nova**.
- **Princípio X** manda `204` para DELETE. Trocar para `200 + body` violaria a convenção e tocaria mais testes. O projeto **já** carrega metadado de DELETE em header (`X-Book-Deleted`, `chapter-service` rotas), e `apiFetch` expõe `result.headers`. Adicionar `X-Chapters-Version` é a opção idiomática e de menor atrito.
- PATCH já retorna envelope `{ data, meta }` (`chapters/[id]/route.ts:28`); `meta.chaptersVersion` cabe naturalmente ao lado de `meta.bookStatus`.

**Resolve a decisão pendente da spec** ("DELETE `204` sem corpo → `200` com envelope?"): **mantém `204`**, usa header.

**Alternativas consideradas**:
- *DELETE/bulk-delete → `200` com envelope `{ data: { chaptersVersion, bookStatus, bookDeleted } }`*: rejeitado — conflita com Princípio X ("204 para DELETE"), quebra o contrato atual e exige reescrever mais asserts E2E/integration. Ganho nulo sobre header.
- *Não devolver o token e re-sincronizar só via refresh*: rejeitado — mantém a dependência frágil; viola FR-005.

---

## D3 — Recuperação de conflito de versão sem `router.refresh()`

**Decisão**: `handleChaptersConflict` re-sincroniza via `GET /api/v1/books/:id` (com `apiFetch`), aplicando o detalhe retornado ao estado local (chapters + status + pdfUrl + chaptersVersion).

**Rationale**:
- O endpoint **já existe** e devolve o detalhe completo: `GET /api/v1/books/:id` → `{ data: detail }` com `chapters` e `chaptersVersion` (`src/app/api/v1/books/[id]/route.ts:16`). Nenhum endpoint novo (Princípio IV).
- Remove a última dependência do `router.refresh()` no caminho de recuperação — coerente com o objetivo da feature.
- O toast de conflito ("Outro usuário alterou os capítulos deste livro…") continua vindo do `apiFetch` da mutação que falhou (409 mapeado pelo catálogo `errorCodes`), não de `handleChaptersConflict` — então o feedback ao usuário é preservado; o handler apenas re-sincroniza o estado.

**Alternativas consideradas**:
- *Manter `router.refresh()` no conflito*: rejeitado — é o mecanismo que trava; o conflito é justamente um momento em que precisamos de re-sync confiável.
- *Criar endpoint dedicado `/books/:id/chapters` de leitura*: rejeitado — o `GET /books/:id` já cobre; criar rota nova viola YAGNI.

**Nota de design**: `handleChaptersConflict` passa a ser `async`. Se o GET falhar (raro), o `apiFetch` já trata o erro (toast + 401-redirect); o estado local permanece o anterior (sem corromper). Não há swallow silencioso.

---

## D4 — Restaurar o `loading.tsx` do detalhe e o comportamento sob streaming

**Decisão**: Restaurar `src/app/(authenticated)/books/[id]/loading.tsx` e o describe `"/books/[id] loading state"` exatamente como no commit `d4154de`. Aceitar que, sob streaming, o livro inexistente responde **HTTP 200** (shell) e ajustar o E2E para verificar a **UI** de not-found.

**Rationale (confirmado via Context7 — `/vercel/next.js`)**:
- "When a `<Suspense>` fallback renders or a component suspends, the server commits to a **200 OK** status to start the HTML stream. If a `notFound()` or `redirect()` fires mid-stream, Next.js cannot change the HTTP status code; instead, it injects a noindex meta tag for 404s or performs a client-side redirect."
- O `page.tsx` do detalhe faz `await` nos serviços e só então chama `notFound()` (`books/[id]/page.tsx:32`). Com `loading.tsx` presente, esse `await` aciona o streaming → 200 commit → `notFound()` mid-stream renderiza o `not-found.tsx` (que tem `data-testid="not-found-message"` e `<h1>404</h1>`), mas o status HTTP da navegação é 200.
- A listagem foi movida para `books/(list)/` na 031 justamente para escopar o boundary de loading da listagem sem envolver `[id]`; o `loading.tsx` do detalhe entra em `books/[id]/` sem afetar a listagem.

**Alternativa considerada (rejeitada)**: *Check de existência rápido antes do `<Suspense>`/`await` para preservar o 404 real* (padrão recomendado pelo Next.js para "real 404 before streaming"). Rejeitado por YAGNI: exigiria uma query de existência adicional dedicada antes do fetch principal, só para manter o status HTTP 404 num caso (id inválido digitado à mão) sem valor de produto — a UI de not-found já comunica o erro ao usuário. Documentado caso a SEO de 404 se torne requisito futuro.

---

## D5 — Ajuste do E2E de medição de altura (`chapters-table-scroll`)

**Decisão**: Antes de medir `clientHeight/scrollHeight/boundingBox`, aguardar a **visibilidade** da primeira linha de capítulo (`chapter-row-*`), não apenas sua presença no DOM.

**Rationale**: Com `loading.tsx`/Suspense, o conteúdo real entra no DOM **oculto** antes do swap do fallback. Medições disparadas cedo leem alturas de um nó ainda não pintado, gerando flakiness. Aguardar `toBeVisible()` da 1ª linha torna a medição determinística. Padrão idêntico ao já usado em `books-loading-skeleton.spec.ts` (031).

**Alternativa considerada**: *`waitForLoadState('networkidle')`* — rejeitado: menos determinístico que aguardar o elemento-alvo específico; pode passar antes do swap do Suspense.

---

## D6 — Evidência de aceite (anti-flake)

**Decisão**: O `chapter-reorder-then-add.spec.ts` é o teste de aceite (SC-001). Critério: **verde em 10 execuções consecutivas COM o `loading.tsx` do detalhe presente**. Execução de verificação: `bun run test:e2e` apontando o spec, repetido (ex.: `--repeat-each=10` do Playwright, mantendo a chamada via script do `package.json` quando possível, ou laço de shell).

**Rationale**: O bug é intermitente (0/4 com o arquivo antes da correção); um único run verde não prova ausência de regressão. 10 execuções consecutivas é um padrão razoável para detectar intermitência sem custo desproporcional. O spec já valida na linha 84 que o capítulo criado (`Capítulo 3`) fica visível — asserção que só passa com a inserção otimista quando o `loading.tsx` está presente.

**Alternativa considerada**: *N = 4* (espelhar o histórico 0/4) — rejeitado por margem pequena; *N = 50* — rejeitado por custo de CI desproporcional ao risco.

---

## Achados de leitura do código (fundamentação)

| Achado | Arquivo | Implicação |
|---|---|---|
| POST já devolve `chapter + bookStatus + chaptersVersion` | `api/v1/books/[id]/chapters/route.ts:33` | D1 sem query extra |
| `handleChapterCreated` só seta token + refresh (não insere) | `hooks/use-book-detail.ts:169` | Ponto único de exposição (raiz do bug) |
| `update/delete/bulkDelete` computam mas descartam o token | `services/chapter-service.ts:180,214,262` | D2 = só propagar no result type |
| PATCH retorna `{ data, meta: { bookStatus } }` | `api/v1/chapters/[id]/route.ts:28` | D2: adicionar `meta.chaptersVersion` |
| DELETE/bulk-delete `204` + header `X-Book-Deleted` | `chapters/[id]/route.ts:61`, `bulk-delete/route.ts:32` | D2: adicionar header `X-Chapters-Version` |
| `GET /books/:id` devolve detalhe completo | `api/v1/books/[id]/route.ts:16` | D3 reusa endpoint existente |
| `densifyPositions` é helper puro de domínio | `lib/domain/normalize-positions` | D1 reuso no cliente |
| `loading.tsx` + teste preservados | commit `d4154de` | D4 = restaurar |
| `not-found.tsx` tem `data-testid="not-found-message"` | `app/(authenticated)/not-found.tsx:15` | D4: assert da UI |
| `apiFetch` expõe `result.headers` e trata 401/erros | `lib/api/api-fetch.ts` | D2/D3 sem tratamento ad-hoc |

Todos os NEEDS CLARIFICATION resolvidos. Pronto para Phase 1.
