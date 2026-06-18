# Implementation Plan: Chapter Edit Flow — Keyboard Save & Flexible Status

**Branch**: `036-chapter-edit-flow` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/036-chapter-edit-flow/spec.md`

## Summary

Duas mudanças no fluxo de edição inline de capítulos:

1. **Teclado (US2)**: `Enter` salva e `Esc` cancela a linha de edição a partir de qualquer campo, de forma **open-aware** (se um seletor/calendário estiver aberto, a tecla age primeiro nele; com nada aberto, salva/cancela). Implementado por um único handler de teclado no nível da linha (`<TableRow>`), vivendo no hook co-localizado (Princípio VII), que detecta popup aberto via `aria-expanded="true"` / `data-slot` de conteúdo e ignora os botões de ação.

2. **Transições de status (US1)**: movimento livre entre todos os status **não-pagos**, com narrador + editor + minutagem (> 0) exigidos apenas nas bordas de `completed` e `paid`; `paid` mantém arestas estreitas (entra só de `completed`, sai só para `completed` com confirmação) e imutabilidade financeira. Mudança **full-stack**: a máquina de estados de domínio (`isValidTransition`) é a fonte da verdade; o `ChapterService` a aplica; o seletor da UI (`reachableTargets`) espelha a topologia. Requer **emenda da constituição** (Princípio III) — ver Constitution Check.

Abordagem técnica confirmada por leitura do código + Context7 (Base UI v1.3): nenhuma mudança de schema, migração ou dependência nova; o contrato do `PATCH /api/v1/chapters/:id` não muda de forma (as regras de transição são validadas no domínio, não no Zod).

## Technical Context

**Language/Version**: TypeScript 5.9.3 sobre Bun 1.2 (runtime + package manager + test runner)

**Primary Dependencies**: Next.js 16.2.1 (App Router), React 19.2.4, `@base-ui/react` 1.3 (Select/Popover — **portaliza popups; eventos sintéticos do React ainda sobem pela árvore React**), `react-hook-form` 7.72 (form na linha de edição), `react-day-picker` 10 (calendário de prazo), Zod 4, Drizzle ORM 0.45 + PostgreSQL. Sem dependências novas.

**Storage**: PostgreSQL via Drizzle. **Nenhuma mudança de schema/migração** — apenas regras de transição e UI.

**Testing**: Vitest (unit em `__tests__/unit/`, integration com DB real + BEGIN/ROLLBACK em `__tests__/integration/`), Playwright (E2E schema-per-worker em `__tests__/e2e/`).

**Target Platform**: Web app autenticado (desktop + mobile, mobile-first).

**Project Type**: Next.js App Router web app (Clean Architecture no backend — Princípio VI).

**Performance Goals**: Sem impacto de performance (mudança comportamental local). LCP < 1s mantido; nenhum bundle novo no cliente.

**Constraints**: Integridade financeira (Princípio II) — `edited_seconds > 0` exigido antes de `paid` para que nenhum ganho seja travado em R$ 0. Server permanece fonte da verdade (UI nunca aceita transição que o servidor recusa — FR-017).

**Scale/Scope**: Mudança cirúrgica — 1 helper de domínio puro, 1 service, 1 seletor de UI, 1 hook de linha, 2 catálogos de mensagem; sem novas telas, rotas ou entidades.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Status | Observação |
|---|---|---|
| I. Capítulo como unidade | ✅ Pass | Toda operação no nível do capítulo; `book.status` recomputado na mesma transação (inalterado). |
| II. Precisão financeira | ✅ Pass | Fórmula de ganho intocada. O guard `edited_seconds > 0` movido para as bordas `completed`/`paid` **fortalece** a integridade (nenhum `paid` com ganho zero). |
| III. Integridade do ciclo de vida | ✅ **Emenda aplicada (v2.18.0)** | A feature relaxa intencionalmente a sequência obrigatória (movimento livre entre não-pagos; requisitos de campo movidos para `completed`/`paid`; `retake` não mais restrito a vir de `reviewing`). Autorizado por **FR-018** e já **emendado** via `/speckit-constitution` (Princípio III reescrito, v2.17.0 → v2.18.0; CLAUDE.md espelhado). A constituição agora **permite** o novo grafo. ⚠️ Pendente apenas a **revisão dupla** (regra do modelo financeiro) antes do merge — rastreada em tasks T002/T020. Transições continuam explícitas, validadas e auditadas — o que muda é o grafo permitido, não a disciplina de validação. |
| V. TDD (100% cálculo, integração p/ lifecycle) | ✅ Pass | `isValidTransition` é domínio puro → 100% unit. Transições no service → integração. Testes ANTES da implementação. |
| VI. Clean Architecture | ✅ Pass | Regra no domínio (`chapter-state-machine.ts`); orquestração no service; controller fino inalterado. |
| VII. Frontend (apresentacional + hook) | ✅ Pass | Lógica de teclado (handler) e de mutação ficam no hook `use-chapter-row-edit.ts`; o componente só renderiza JSX e fia `onKeyDown`. `reachableTargets` é helper puro no componente do seletor. |
| X. API REST | ✅ Pass | Sem nova rota; envelope/Zod inalterados; erros via `withApiErrorHandler` + catálogo PT-BR. |
| XI. PostgreSQL | ✅ Pass | Sem schema/migração. |
| XII. Anti-padrões | ✅ Pass | Sem `fetch`/`useEffect`/`router.refresh` no componente; sem toast de sucesso; sem HTML cru; mensagens de erro sem jargão de campo. |
| XV. Skills/Context7 | ✅ Pass | Context7 consultado para Base UI (Select/Popover). |
| XVI. Verificação final única | ✅ Pass | lint/build/suítes só na fase final. |

**Gate decision**: PASS condicional. A única tensão (Princípio III) é uma **mudança deliberada de governança** explicitamente solicitada e capturada como FR-018, não uma violação acidental. A emenda da constituição é um item obrigatório do plano (ver tasks de governança). Sem violações injustificadas → prosseguir.

## Project Structure

### Documentation (this feature)

```text
specs/036-chapter-edit-flow/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (state machine matrix)
├── quickstart.md        # Phase 1 output (manual verification)
├── contracts/
│   ├── chapter-transition-rules.md   # domain + PATCH semantics
│   └── edit-row-keyboard.md          # keyboard interaction contract
└── checklists/
    └── requirements.md  # (from /speckit-specify)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── domain/
│   │   └── chapter-state-machine.ts      # [EDIT] rewrite isValidTransition (free non-paid; guards on completed/paid; narrow paid edges)
│   │   └── chapter-transitions.ts        # [EDIT] reword REASON_MESSAGES for new context
│   ├── services/
│   │   └── chapter-service.ts            # [EDIT] simplify update guard flow; drop assertReversion (absorbed by state machine); keep assertPaidLocked
│   └── api/error-codes/
│       └── chapter.ts                    # [EDIT] reword CHAPTER_NARRATOR_REQUIRED / CHAPTER_EDITOR_REQUIRED (PT-BR) for "concluir/pagar"
└── components/features/chapters/
    ├── chapter-status-select.tsx         # [EDIT] rewrite reachableTargets (topology only)
    ├── chapter-row-edit-mode.tsx         # [EDIT] wire onKeyDown={handleRowKeyDown} on <TableRow>
    ├── chapter-row-edit-actions.tsx      # [EDIT] add data-row-actions marker so Enter on Cancel stays native
    └── hooks/
        └── use-chapter-row-edit.ts       # [EDIT] expose handleRowKeyDown (open-aware Enter→submit, Esc→cancel)

__tests__/
├── unit/domain/chapter-state-machine.spec.ts          # [REWRITE] full new transition matrix (100%)
├── unit/domain/chapter-transitions.spec.ts            # [EDIT] message/wrapper updates
├── unit/components/features/chapters/
│   ├── use-chapter-row-edit.spec.tsx                  # [EDIT] handleRowKeyDown cases (renderHook)
│   └── chapter-status-select.spec.tsx                 # [ADD] reachable/disabled options per current status
├── integration/chapter-update.spec.ts                 # [EDIT] new transitions, paid edges, field guards, reversion
└── e2e/chapters-edit-inline.spec.ts                   # [EDIT] Enter-save, Esc-cancel, free status change

.specify/memory/constitution.md                        # [EDIT] amend Principle III (governance task, double review)
```

**Structure Decision**: App Next.js single-repo com Clean Architecture no backend. A mudança de domínio segue o caminho canônico `domain → service → (controller inalterado)`; a mudança de UI segue `componente apresentacional + hook co-localizado`. Não há nova feature folder — tudo reside em `src/components/features/chapters/` e `src/lib/domain|services|api`.

## Complexity Tracking

> Nenhuma violação injustificada. A tensão com o Princípio III é resolvida por emenda explícita (FR-018), não por exceção arquitetural — portanto não há item de complexidade a justificar aqui. A unificação no service (remover `assertReversion` em favor de `isValidTransition` tratar `from === "paid"`) **reduz** complexidade.
