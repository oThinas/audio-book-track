# Specification Quality Checklist: Chapter titles, reordering, and extra-chapter templates

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-05-14
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Spec passou por `/grill-me` (14 perguntas, decisões registradas abaixo). Nenhum `[NEEDS CLARIFICATION]` pendente.
- Decisões fechadas via grill:
  - **Modelagem**: remover `chapter.number`; adicionar `chapter.title` (NOT NULL, max 100 chars, qualquer Unicode exceto `\n`/`\r`, trim no servidor) e `chapter.position` (int >=0, único por livro, denso 0..N-1, unique constraint DEFERRABLE INITIALLY DEFERRED).
  - **Identidade**: `title` é o rótulo canônico. Capítulos numerados nascem com `Capítulo N` (sem padding). Templates nascem com nome do template.
  - **Renumeração automática**: nunca após reorder. Apenas no momento de criação ou ao adicionar capítulo numerado novo (próximo `N` = `max(N) + 1` considerando apenas títulos com padrão `Capítulo \d+`).
  - **Paid**: reorder e adição de capítulo são liberados em qualquer status; edição de `title` trava quando `paid` (entra em `PAID_LOCKED_FIELDS`).
  - **Interação**: drag-and-drop + botões ↑/↓ visíveis em cada linha (acessibilidade por teclado e mobile).
  - **API reorder**: `PUT /api/v1/books/:bookId/chapters/order` com `{ orderedIds, expectedVersion }`. Operação atômica em transação única.
  - **API add**: reaproveita `POST /api/v1/books/:bookId/chapters` com `{ title, position: "start" | "end" | { after: chapterId } }`. Templates são apenas conveniência de UI (pré-preenchem `title`); não viram conceito de servidor.
  - **API edit**: `PATCH /api/v1/chapters/:id` ganha `title`. Validação no servidor; `title` adicionado a `PAID_LOCKED_FIELDS`.
  - **Concorrência**: nova coluna `book.chapters_version` (int NOT NULL DEFAULT 0), bumpada em toda mutação de capítulo dentro do `BookStatusRecomputeService`. Conflito retorna 409 com mensagem PT-BR.
  - **UX criação**: diálogo atual mantém input numérico para "capítulos numerados" + nova seção "capítulos extras" (lista com template/personalizado + posição).
  - **UX edição (livro existente)**: campo numérico de capítulos é **removido** do diálogo de edição (junto da mensagem auxiliar de redução). Adição vira botão "+ Adicionar capítulo" na página de detalhe, abrindo o mesmo seletor da criação.
  - **Migration**: única migration reversível. Backfill: `title = 'Capítulo ' || number::text`; `position = row_number() over (partition by book_id order by number) - 1` (garante densidade mesmo com buracos).
  - **Features vizinhas**: 024 (agrupamento) e 025 (foco da semana) passam a exibir `title` e ordenar por `position`.
- **Follow-up fora do escopo desta feature** (anotado em Out of Scope): adicionar limites de comprimento a outros campos textuais (`book.title`, `studio.name`, `narrator.name`, `editor.name`).
- Próximo passo: `/speckit-plan` para detalhar arquitetura, migration Drizzle, endpoints e estratégia de testes.
