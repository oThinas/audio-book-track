# Phase 0 — Research: Chapter titles, reordering, and extra-chapter templates

**Feature**: 026-chapter-titles-reordering
**Date**: 2026-05-15

Documento de decisões técnicas. Cada item segue o formato **Decisão / Justificativa / Alternativas consideradas**, com referência cruzada às perguntas do `/grill-me` quando aplicável.

---

## R-001 — Modelagem de identidade e ordem (replace `number` → `title` + `position`)

**Decisão.** Remover `chapter.number` (integer único `(book_id, number)`, check `>= 1`). Adicionar duas colunas:
- `chapter.title text NOT NULL` — rótulo canônico, qualquer Unicode exceto `\n`/`\r`, max 100 chars (CHECK constraint).
- `chapter.position integer NOT NULL` — chave de ordenação, `>= 0` (CHECK), unique `(book_id, position)` **DEFERRABLE INITIALLY DEFERRED**, densa `0..N-1`.

**Justificativa.** Hoje `number` é dual-purpose (rótulo visível + chave de ordenação). Reordenar mudaria o rótulo visível ("Capítulo 5" pode virar "Capítulo 3"), efeito colateral inaceitável especialmente para capítulos `paid`. Separando, ganhamos:
- Estabilidade de rótulos pagos (`title` entra em `PAID_LOCKED_FIELDS`).
- Capacidade de modelar capítulos editoriais não-numerados (`Prólogo`, `Epílogo`) que naturalmente não têm `number`.
- Reorder torna-se operação puramente organizacional, sem efeito em nenhum dado financeiro nem em `title`.

**Alternativas.**
- (A) Renumerar tudo no reorder — descartada (efeito colateral em paid; rótulos voláteis).
- (C) Manter `number` editável independente da posição — descartada (UX dupla que o usuário não pediu; YAGNI).

**Cruz-ref**: grill Q1, Q5.

---

## R-002 — Estratégia de posição: densa vs. gap-based vs. lexorank

**Decisão.** Posição densa: inteiros contíguos `0..N-1` por livro, renormalizados em **toda** mutação que afete ordem (create, delete, reorder, bulk-delete). Não há gaps reservados.

**Justificativa.** Cardinalidade típica ≤ 50 capítulos/livro. Reorder de 50 itens em uma transação faz ≤ 50 UPDATEs em coluna indexada — sub-milissegundo. Invariante "posições são densas" é checável em uma query única (`SELECT COUNT(*), MAX(position), MIN(position) FROM chapter WHERE book_id = ?`).

**Alternativas.**
- **Gap-based (100, 200, 300...)** — economiza writes em moves isolados mas exige rebalanceamento periódico; complexidade desproporcional ao volume.
- **Lexorank/floats** (estilo Jira/Linear) — overkill para ≤ 50 itens; complica debug e queries por ordenação.

**Cruz-ref**: grill Q9.

---

## R-003 — Constraint unique `(book_id, position)` com DEFERRABLE INITIALLY DEFERRED

**Decisão.** Unique constraint declarado como `DEFERRABLE INITIALLY DEFERRED` para permitir UPDATEs em massa de `position` dentro de uma transação sem violação intermediária (ex.: trocar `(A=0, B=1)` para `(A=1, B=0)` exigiria temporariamente A e B com mesmo valor).

**Implementação Drizzle.** O método `uniqueIndex(...)` do `drizzle-orm/pg-core` **não tem flag** `deferrable` no encadeamento. Duas saídas:

1. **(preferida)** Gerar a migration com `drizzle-kit generate`, abrir o `.sql` resultante e adicionar manualmente:

```sql
ALTER TABLE "chapter"
  ADD CONSTRAINT "chapter_book_position_unique"
  UNIQUE ("book_id", "position") DEFERRABLE INITIALLY DEFERRED;
```

Remover a linha gerada automaticamente (`CREATE UNIQUE INDEX ...`) para a mesma combinação. Declarar no schema apenas o índice normal de leitura (`index("chapter_book_position_idx").on(table.bookId, table.position)`) sem unique — a unicidade é garantida pela constraint da tabela.

2. **(alternativa)** Estratégia "offset + settle" sem DEFERRABLE: dentro da transação, primeiro fazer `UPDATE chapter SET position = position + 1000000 WHERE book_id = $1`, depois setar os valores finais. Funciona, mas adiciona 2 UPDATEs em vez de 1 e polui o log. Rejeitada — DEFERRABLE é PostgreSQL nativo e mais limpo.

**Alternativas.**
- Aplicação-only (sem constraint) — sacrifica garantia de banco; rejeitada.
- Constraint imediata + offset+settle — funcional mas duplica writes.

**Cruz-ref**: grill Q9. Referência PostgreSQL: `CREATE TABLE`/`ALTER TABLE ... ADD CONSTRAINT ... UNIQUE (...) DEFERRABLE INITIALLY DEFERRED`.

---

## R-004 — Detecção de conflito concorrente: `book.chapters_version`

**Decisão.** Adicionar `book.chapters_version integer NOT NULL DEFAULT 0`. Cada mutação de capítulo (`create`, `update`, `delete`, `bulkDelete`, `reorder`) bumpa o valor (`chapters_version = chapters_version + 1`) **na mesma transação** em que a mutação ocorre. Reorder e add aceitam `expectedVersion` no body; comparação rejeita 409 quando divergente.

**Justificativa.** Detecta cenários do tipo "Operador B reordenou baseado em estado anterior à mudança do Operador A", evitando sobrescrita silenciosa. Custo: 4 bytes por linha em `book`, +1 UPDATE por mutação. O `BookStatusRecomputeService` já executa um UPDATE em `book` dentro da mesma transação — fundir os dois é gratuito (uma única instrução `UPDATE book SET status = $1, chapters_version = chapters_version + 1 WHERE id = $2`).

**Alternativas.**
- `book.updatedAt` como versão — descartada (`updatedAt` semanticamente representa "livro foi editado", não composição).
- Detecção implícita via mismatch de `orderedIds` — pega apenas casos onde IDs divergem (cap excluído por outro operador), não casos de "mesma lista, ordem velha".
- Last-writer-wins (sem detecção) — rejeitada em favor de UX explícita.

**Cruz-ref**: grill Q10.

---

## R-005 — Catálogo de templates: client-side constante (não tabela DB)

**Decisão.** Templates `Prólogo`/`Epílogo`/`Apresentação` ficam como constante TypeScript em `src/lib/domain/chapter-templates.ts`. Não há tabela `chapter_template` no banco. O servidor recebe apenas `title: string` (já pré-preenchido pelo cliente quando vem de template) — não distingue capítulo "extra via template" de "personalizado" no nível do schema.

**Justificativa.** Templates são conveniência de UI para pré-preencher `title`. Não há atributo extra no banco que diferencie um capítulo "Prólogo" criado via template de um "Prólogo" digitado livremente — são linhas idênticas. Persistir templates como entidade seria YAGNI até existir cenário "operador customiza catálogo de templates" (fora de escopo, declarado em Out of Scope da spec).

**Alternativas.**
- Tabela `chapter_template (id, label, default_title)` — descartada por overengineering.
- Enum em DB — descartado pelo mesmo motivo + dificuldade de evoluir (alteração de enum requer migration).

**Cruz-ref**: grill Q13, FR-018.

---

## R-006 — Interação de reorder: drag-and-drop + botões ↑/↓ (`@dnd-kit/sortable`)

**Decisão.** Biblioteca `@dnd-kit` (3 pacotes: `@dnd-kit/core` ^6.x, `@dnd-kit/sortable` ^8.x, `@dnd-kit/utilities` ^3.x). Drag handle visível na linha (ícone `GripVertical` de `lucide-react`). Botões ↑/↓ visíveis em todas as linhas como fallback acessível por teclado e mobile (gesto de drag em telas pequenas conflita com scroll vertical da tabela). Sem necessidade de `KeyboardSensor` adicional — sensor padrão do `@dnd-kit` cobre Space/Setas.

**Justificativa.** `@dnd-kit` é a opção mainstream pós-deprecação do `react-beautiful-dnd`, com suporte first-class a teclado, screen reader, e zero dependências. Botões redundantes garantem que toda operação possível por arrasto é também possível por teclado, sem mecanismos paralelos divergindo de UX.

**Alternativas.**
- `react-beautiful-dnd` — deprecated.
- `react-sortable-hoc` — deprecated.
- Botões puros — penoso para mover de posição 0 → 30 (30 cliques).
- Drag puro — falha em mobile real (conflito com scroll).

**Cruz-ref**: grill Q4. Verificado via Context7 MCP (resolve-library-id `@dnd-kit/sortable`).

---

## R-007 — API: endpoints e payloads

**Decisão.** Três rotas tocadas + duas novas:

| Rota | Verbo | Status sucesso | Payload | Resposta |
|------|-------|----------------|---------|----------|
| `/api/v1/books` (existente) | POST | 201 | `{ title, studioId, pricePerHourCents, inlineStudioId?, chapters: { numbered: number, extras: Array<{ kind: "template" \| "custom", template?: "prologue" \| "epilogue" \| "presentation", title?: string, position: "start" \| "end" }> } }` | `{ book, chapters }` |
| `/api/v1/books/:id` (existente) | PATCH | 200 | `{ title?, studioId?, pricePerHourCents?, pdfUrl? }` — **sem** `numChapters` | book |
| `/api/v1/books/:bookId/chapters` (novo) | POST | 201 | `{ title: string, position: "start" \| "end" \| { after: chapterId }, expectedVersion: number }` | `{ chapter, bookStatus, chaptersVersion }` |
| `/api/v1/books/:bookId/chapters/order` (novo) | PUT | 200 | `{ orderedIds: string[], expectedVersion: number }` | `{ chaptersVersion }` |
| `/api/v1/chapters/:id` (existente) | PATCH | 200 | `{ status?, narratorId?, editorId?, editedSeconds?, deadline?, title?, confirmReversion? }` | `{ chapter, bookStatus, chaptersVersion }` |

**Justificativa.** Reaproveita endpoints existentes (PATCH chapter, POST/PATCH book) estendendo schemas Zod. Cria dois endpoints novos para criação/reorder com semântica clara. Reorder é **declarativo** (`PUT` na ordem inteira) — mais simples de validar e mais fácil de mockar em testes do que operações diff. Erros de conflito de versão retornam `409` com código `BOOK_CHAPTERS_VERSION_CONFLICT`.

**Alternativas.**
- PATCH per-chapter para reorder — cliente faria N requests, atomicidade impossível.
- POST `/chapters/reorder` com moves diff — atrai bugs de cancelamento.

**Cruz-ref**: grill Q5, Q13. Padrões de API REST conforme `rules/web/coding-style.md` + `lib/api/with-error-handler.ts`.

---

## R-008 — Migration plan

**Decisão.** Migration única `0008_chapter_title_position_book_version.sql` (gerada por `drizzle-kit generate` + edição manual para DEFERRABLE), aplicada via `bun run db:migrate`. Reversível.

**Forward.**

```sql
-- 1) Adicionar coluna chapters_version em book
ALTER TABLE "book" ADD COLUMN "chapters_version" integer NOT NULL DEFAULT 0;

-- 2) Adicionar title e position em chapter (nullable temporariamente para backfill)
ALTER TABLE "chapter" ADD COLUMN "title" text;
ALTER TABLE "chapter" ADD COLUMN "position" integer;

-- 3) Backfill title com 'Capítulo ' || number
UPDATE "chapter" SET "title" = 'Capítulo ' || "number"::text;

-- 4) Backfill position densificada por row_number sobre number
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY book_id ORDER BY number) - 1 AS new_position
  FROM "chapter"
)
UPDATE "chapter" c SET "position" = r.new_position
FROM ranked r WHERE c.id = r.id;

-- 5) Constraints e índices
ALTER TABLE "chapter" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE "chapter" ALTER COLUMN "position" SET NOT NULL;
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_title_length" CHECK (length("title") <= 100);
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_title_no_newline" CHECK ("title" !~ E'[\\n\\r]');
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_position_nonnegative" CHECK ("position" >= 0);
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_book_position_unique" UNIQUE ("book_id", "position") DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX "chapter_book_position_idx" ON "chapter" ("book_id", "position");

-- 6) Remover number e seus artefatos
DROP INDEX "chapter_book_number_unique";
ALTER TABLE "chapter" DROP CONSTRAINT "chapter_number_positive";
ALTER TABLE "chapter" DROP COLUMN "number";
```

**Rollback.**

```sql
ALTER TABLE "chapter" ADD COLUMN "number" integer;
UPDATE "chapter" SET "number" = "position" + 1;
ALTER TABLE "chapter" ALTER COLUMN "number" SET NOT NULL;
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_number_positive" CHECK ("number" >= 1);
CREATE UNIQUE INDEX "chapter_book_number_unique" ON "chapter" ("book_id", "number");
ALTER TABLE "chapter" DROP CONSTRAINT "chapter_book_position_unique";
DROP INDEX "chapter_book_position_idx";
ALTER TABLE "chapter" DROP CONSTRAINT "chapter_title_length";
ALTER TABLE "chapter" DROP CONSTRAINT "chapter_title_no_newline";
ALTER TABLE "chapter" DROP CONSTRAINT "chapter_position_nonnegative";
ALTER TABLE "chapter" DROP COLUMN "title";
ALTER TABLE "chapter" DROP COLUMN "position";
ALTER TABLE "book" DROP COLUMN "chapters_version";
```

**Justificativa.** Single transaction, idempotente em ambiente de teste (schema-per-worker recria do zero). Backfill por `row_number()` garante densidade mesmo se a coluna `number` legada tem gaps (chapters deletados sem renumeração — comportamento atual do projeto).

**Alternativas.**
- Três migrations separadas (add → backfill → drop) — desnecessário, sem deploy contínuo crítico.
- `drizzle-kit push` — proibido pela constituição.

**Cruz-ref**: grill Q12.

---

## R-009 — Mutação otimista no cliente para reorder

**Decisão.** Hook `use-chapters-reorder` aplica nova ordem **antes** de receber resposta do servidor (mutação otimista). Em caso de erro (rede ou 409), reverte para a ordem anterior e dispara toast de erro com a mensagem PT-BR vinda do catálogo. Mutação otimista usa um `useReducer` local; persistência via `apiFetch` (que já trata 401/redirect e dispara toast por código).

**Justificativa.** Reorder é uma interação direta — usuário arrasta uma linha e espera ver o resultado imediato. Round-trip mostra latência desnecessária para a operação mais frequente da feature. Com `book.chapters_version`, conflito é detectado e revertido com mensagem clara.

**Alternativas.**
- Pessimista (esperar resposta) — UX inferior; usuário vê delay de centenas de ms entre soltar e ver a nova ordem.
- SWR/TanStack Query mutation — projeto não usa essas libs; consistente com `apiFetch` existente.

**Cruz-ref**: padrões `frontend-patterns` (state management).

---

## R-010 — Códigos de erro novos no catálogo

**Decisão.** Adicionar ao catálogo (`src/lib/api/error-codes/*`):

```ts
// chapter.ts (extensão)
CHAPTER_TITLE_INVALID: {
  status: 422,
  message: "Título do capítulo é obrigatório, com até 100 caracteres e sem quebras de linha.",
}
// CHAPTER_PAID_LOCKED já existe; atualizar a mensagem para mencionar "título":
// "Este capítulo já está pago — título, narrador, editor, duração e prazo não podem ser alterados."
// CHAPTER_NUMBER_ALREADY_IN_USE: REMOVER (não há mais number)

// chapter.ts (novos)
CHAPTER_POSITION_TARGET_INVALID: {
  status: 422,
  message: "Posição de inserção inválida.",
}
CHAPTERS_ORDER_MISMATCH: {
  status: 422,
  message: "A lista enviada não corresponde aos capítulos atuais do livro.",
}

// book.ts (novo)
BOOK_CHAPTERS_VERSION_CONFLICT: {
  status: 409,
  message: "Outro usuário alterou os capítulos deste livro. Recarregue a página para ver o estado mais recente.",
}
```

**Justificativa.** Cada erro recebe código específico para que `apiFetch` no cliente dispare toast com a mensagem correta. `CHAPTER_NUMBER_ALREADY_IN_USE` deixa de existir porque não há mais coluna `number` única — duplicidade de `title` é permitida. `CHAPTERS_ORDER_MISMATCH` cobre o caso em que `orderedIds` envia conjunto ≠ capítulos atuais do livro (após criação/exclusão concorrente, sem que `expectedVersion` seja informada).

**Cruz-ref**: grill Q10, feature 023 (catálogo de erros).

---

## R-011 — Algoritmo de "próximo Capítulo N" em adições incrementais

**Decisão.** Helper puro `nextChapterTitle(existingTitles: string[]): string`:
1. Filtra `existingTitles` que matcham o regex `/^Capítulo (\d+)$/`.
2. Extrai o inteiro do grupo.
3. Retorna `Capítulo {max + 1}` (ou `Capítulo 1` se conjunto vazio).
4. Capítulos com título customizado (`"Prólogo"`, `"Nota do tradutor"`) são ignorados — não interferem na contagem.

**Justificativa.** Atende FR-007. O regex é estrito (`^Capítulo \d+$`) para evitar falsos positivos com strings tipo `"Capítulo 3 — Bonus"` (esses são tratados como custom). Determinístico, sem ambiguidade, 100% testável.

**Alternativas.**
- `Capítulo` (case-insensitive) ou aceitar acentos variantes — descartado por baixo benefício e risco de falso positivo.
- Estado server-side mantendo "próximo N por livro" — descartado, computável determinísticamente da lista atual.

**Cruz-ref**: grill Q2c, FR-007.

---

## R-012 — Skill consultations (Context7 MCP + design.pen)

**Consultas registradas antes do code:**
- `@dnd-kit/sortable` — Context7 MCP, query "sortable + keyboard sensor + accessibility". Confirmado: sensor padrão suporta keyboard via Space/Setas; `SortableContext` com `verticalListSortingStrategy`.
- `drizzle-orm DEFERRABLE` — Context7 MCP, query "drizzle pg-core deferrable constraint". Confirmado: não há helper; usar `sql\`...\`` na definição do índice **ou** editar SQL gerado.
- `design.pen` — abrir o documento e capturar visual de drag handle, botões ↑/↓ na linha, e o dialog "+ Adicionar capítulo" antes de implementar UI (validar com `mcp__pencil__get_screenshot` na fase de implementação).

**Cruz-ref**: Princípio XV da constituição (skills obrigatórias).
