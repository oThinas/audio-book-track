# Specification Quality Checklist: CRUD de Livros e Capítulos

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-04-23
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

- **Sessão de clarificação 2026-04-23 concluída com múltiplas rodadas cobrindo:**
  - Q1 — status do livro: campo `book.status` persistido como cache materializado (Opção C).
  - Q2 — exclusão de estúdio: soft-delete (`studio.deleted_at`).
  - Q3 — exclusão de narrador/editor: soft-delete simétrico.
  - Q4 — `default_hourly_rate_cents` em criação inline: placeholder `1` (R$ 0,01) + propagação transacional do `price_per_hour_cents` do livro; toast de alerta se livro não for criado.
  - Q5 — livro sem capítulos: proibido (invariante absoluta ≥ 1 capítulo).
  - Q6 — colunas editáveis do capítulo: narrador, editor, status, `edited_seconds` (4 campos; UI aceita entrada em horas e converte); o KPI 4 (constitution v2.13.0) usa `edited_seconds ÷ 60` para minutos, sem campo adicional.
  - Q7 — reversão `paid → concluído`: permitida mediante modal de confirmação dupla e flag `confirmReversion: true` no payload.
  - Q8 — modo de exclusão em lote: ícones/botão ocultados (não apenas desabilitados).
  - Q9 — desarquive: automático por colisão de nome (aplicável a estúdio, narrador e editor).
  - Q10 — unificação FK: nenhuma FK usa `SET NULL`; todas usam `RESTRICT` e soft-delete.
  - Q11 — recomputação de `book.status`: obrigatória em toda mutação de capítulo; cenários de teste codificados em US5.13 e US5.14.
- Referências técnicas em FRs e Assumptions estão preservadas propositalmente — a constituição fixa decisões de stack. User-facing permanece tecnologia-agnóstico.
- Spec está pronta para `/speckit-plan`.

## Validação pós-implementação (T142, 2026-04-29)

Todos os critérios desta checklist foram revisados após a implementação completa
(Phases 1–14). Evidências:

- **Acceptance scenarios cobertos por testes**: todas as user stories US1–US12
  têm specs E2E + integration + unit conforme [tasks.md](../tasks.md).
- **Success criteria mensuráveis aprovados**:
  - SC-010 (cobertura 100% em `book-status.ts` + `chapter-state-machine.ts`):
    validado por T142a.
  - SC-011 (overhead < 100ms para COUNT em derived columns): validado por
    T142b — overhead medido ≈ 0,6ms versus 100ms de teto.
- **Edge cases**: soft-delete com nome duplicado (desarquive automático),
  reversão `paid → completed` com confirmação dupla, recomputação de
  `book.status` em todas as mutações de capítulo — todos cobertos.
- **No leak FR-017**: validado por T142c (`api-error-responses.spec.ts`).
- **Self-review**: ver [self-review.md](../self-review.md).
