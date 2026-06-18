---
description: "Task list for Chapter Edit Flow — Keyboard Save & Flexible Status"
---

# Tasks: Chapter Edit Flow — Keyboard Save & Flexible Status

**Input**: Design documents from `/specs/036-chapter-edit-flow/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: REQUIRED — TDD is mandatory (Constitution Principle V). `isValidTransition` is pure domain logic → **100% unit coverage**; lifecycle transitions → integration. Write tests FIRST, see them FAIL, then implement.

**Organization**: Grouped by user story. US1 (flexible status, P1) and US2 (keyboard, P2) are **independent** and touch disjoint files except the shared E2E spec.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 (Setup, Foundational, Polish have no story label)

---

## Phase 1: Setup

**Purpose**: Confirm working state. No project init — existing repo, no new dependencies.

- [ ] T001 Confirm branch `036-chapter-edit-flow` is checked out and `package.json` is unchanged (no new dependencies per plan Technical Context); skim `spec.md`, `data-model.md`, and both `contracts/*.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Governance — define the relaxed lifecycle rules in the constitution BEFORE coding US1 against them.

**⚠️ CRITICAL**: Blocks **US1** (domain code must match the amended rules). **US2 (keyboard) is independent and may proceed in parallel** — it does not depend on this phase.

- [x] T002 Amend `.specify/memory/constitution.md` Principle III (Integridade do Ciclo de Vida): replace the strict sequential graph with the new rules — free movement between non-paid statuses; narrator + editor + `edited_seconds > 0` required to enter `completed` **and** `paid`; `paid` narrow edges (enter only from `completed`; leave only to `completed` with reversion confirmation); `retake` no longer restricted to coming from `reviewing`; `paid` as sole guarded status. Add a SYNC IMPACT REPORT block and bump version `2.17.0 → 2.18.0` (MINOR). **DONE** via `/speckit-constitution` (also fixed the stale footer 2.16.0 → 2.18.0). ⚠️ REVISÃO DUPLA still pending → enforced by T020 before merge.
- [x] T003 Mirror the amended lifecycle into `CLAUDE.md` → "Regras Não-Negociáveis" → Domínio → "Ciclo de vida do capítulo" (and the matching status pré-condições), so the inline critical rules match the constitution. **DONE** (mirrored in the same amendment).

**Checkpoint**: Lifecycle rules ratified → US1 implementation can encode them.

---

## Phase 3: User Story 1 - Flexible chapter status, paid protected (Priority: P1) 🎯 MVP

**Goal**: Allow direct transitions between any non-paid statuses (no field requirements); require narrator + editor + minutagem (>0) to enter `completed`/`paid`; keep `paid` narrow edges + financial immutability. Full-stack (domain → service → UI mirror), server is source of truth.

**Independent Test**: Set a `pending` chapter directly to `reviewing` in one save; confirm `paid` is only reachable from `completed` and only revertible to `completed` with confirmation; confirm `completed`/`paid` are blocked (field-specific 422) when narrator/editor/seconds are missing.

### Tests for User Story 1 (write FIRST — must FAIL) ⚠️

- [ ] T004 [P] [US1] Rewrite the transition-matrix unit tests in `__tests__/unit/domain/chapter-state-machine.spec.ts` to cover the full new matrix (every from→to pair): free non-paid moves VALID; `→ completed`/`→ paid` require narrator→editor→editedSeconds (first-missing wins); `→ paid` only from `completed`; `paid → completed` needs `confirmReversion`; `paid → {≠completed}` INVALID. Run `bun run test:unit` on this file → FAIL.
- [ ] T005 [P] [US1] Update `__tests__/unit/domain/chapter-transitions.spec.ts` for the new matrix + reworded PT-BR `REASON_MESSAGES`. → FAIL.
- [ ] T006 [P] [US1] Add `__tests__/unit/components/features/chapters/chapter-status-select.spec.tsx` asserting `reachableTargets` topology via rendered options: non-paid (non-completed) current → `paid` disabled; `completed` current → `paid` enabled; `paid` current → only `paid` + `completed` enabled. → FAIL.
- [ ] T007 [US1] Extend integration tests in `__tests__/integration/chapter-update.spec.ts` (real DB): free non-paid transitions succeed; `→ completed`/`→ paid` with each missing field returns its specific error code; `pending → paid` → `CHAPTER_INVALID_TRANSITION`; `completed → paid` with all fields → 200; `paid → completed` without/with `confirmReversion`; `paid → reviewing` → invalid; mutating a financial field while `paid` → `CHAPTER_PAID_LOCKED`; **and a successful status transition still writes a `CHAPTER_STATUS_TRANSITION` audit row (FR-016 regression guard)**. → FAIL.

### Implementation for User Story 1 (make GREEN)

- [ ] T008 [US1] Rewrite `isValidTransition` in `src/lib/domain/chapter-state-machine.ts` per the matrix in `data-model.md` (pure function; field-check order narrator→editor→editedSeconds). Makes T004 green.
- [ ] T009 [US1] Refactor `ChapterService.update` in `src/lib/services/chapter-service.ts`: keep `assertPaidLocked` (runs whenever `current.status === "paid"`); route every status change through `assertTransition` (now also handles `from === "paid"`); **delete `assertReversion`**. Makes T007 green. (Depends on T008.)
- [ ] T010 [P] [US1] Reword PT-BR messages `CHAPTER_NARRATOR_REQUIRED`, `CHAPTER_EDITOR_REQUIRED`, **and** `CHAPTER_EDITED_SECONDS_REQUIRED` in `src/lib/api/error-codes/chapter.ts` to the "concluir ou pagar" context (research R6 — A1 resolved: the seconds message IS extended, not optional).
- [ ] T011 [P] [US1] Reword `REASON_MESSAGES` in `src/lib/domain/chapter-transitions.ts` consistently with T010. Makes T005 green.
- [ ] T012 [US1] Rewrite `reachableTargets` in `src/components/features/chapters/chapter-status-select.tsx` to the topology-only table (paid disabled unless current is `completed`; paid current → `paid` + `completed`). Makes T006 green.

### E2E for User Story 1

- [ ] T013 [US1] Extend `__tests__/e2e/chapters-edit-inline.spec.ts`: a free status change (e.g. `pending → reviewing` in a single save) and paid-guard visibility (paid option disabled until `completed`). (Shares the E2E file with T018 — sequence, do not run in parallel with T018.)

**Checkpoint**: Flexible status fully functional end-to-end; `paid` still guarded; money never lockable at R$0.

---

## Phase 4: User Story 2 - Save with Enter / cancel with Esc from any field (Priority: P2)

**Goal**: `Enter` saves and `Esc` cancels the inline edit row from any control, open-aware (open popup acts first; nothing open → save/cancel); action buttons keep native behavior; no double submit.

**Independent Test**: Focus each control and press Enter/Esc; verify save/cancel happen only when no dropdown/calendar is open, and that an open popup's keyboard behavior is preserved.

**Note**: Independent of US1 — different files (except the shared E2E spec). Can start right after Phase 1.

### Tests for User Story 2 (write FIRST — must FAIL) ⚠️

- [ ] T014 [P] [US2] Add `handleRowKeyDown` cases to the hook test `__tests__/unit/components/features/chapters/hooks/use-chapter-row-edit.spec.tsx` (`renderHook`): Enter (nothing open) → `onSubmit` called; Enter with target carrying `aria-expanded="true"` or inside `[data-slot="select-content"]`/`[data-slot="popover-content"]` → no submit; Enter on target inside `[data-row-actions]` → no submit; Enter while `isSubmitting` → no submit; Escape (nothing open) → `onCancel`; Escape with popup open → no cancel. → FAIL.

### Implementation for User Story 2 (make GREEN)

- [ ] T015 [US2] Add `handleRowKeyDown(event)` to `src/components/features/chapters/hooks/use-chapter-row-edit.ts` and expose it in the return object/type: on `Enter` → `preventDefault()` + `form.handleSubmit(onSubmit)()`; on `Escape` → `preventDefault()` + `onCancel()`; early-return when a popup is open (`aria-expanded="true"` / content `data-slot`), when target is inside `[data-row-actions]`, or when `form.formState.isSubmitting`. Makes T014 green. (Depends on T014.)
- [ ] T016 [US2] Wire `onKeyDown={handleRowKeyDown}` on the edit-mode `<TableRow data-mode="edit">` in `src/components/features/chapters/chapter-row-edit-mode.tsx`.
- [ ] T017 [P] [US2] Add `data-row-actions` to the actions `<TableCell>` in `src/components/features/chapters/chapter-row-edit-actions.tsx` so Enter/Esc on Save/Cancel keep native behavior.

### E2E for User Story 2

- [ ] T018 [US2] Add keyboard scenarios to `__tests__/e2e/chapters-edit-inline.spec.ts`: Enter from title saves; Enter from closed status trigger saves; open status dropdown + Enter selects (2nd Enter saves); Esc cancels; Esc closes open dropdown first, 2nd Esc cancels; Enter on Cancel cancels; **Enter with an empty title → validation error shown, not saved (FR-005)**. (Shares the E2E file with T013 — sequence after T013.)

**Checkpoint**: Both stories independently functional.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T019 [P] Run `specs/036-chapter-edit-flow/quickstart.md` sections A & B manually (status + keyboard, light + dark mode).
- [ ] T020 Run `/code-review` focused on Principles II (precisão financeira) and III (ciclo de vida) for the domain/service diff — part of the required REVISÃO DUPLA before merge.
- [ ] T021 Final verification gate (Principle XVI), in order: `bun run lint` (zero warnings) → `bun run test:unit` → `bun run test:integration` → `bun run test:e2e` → `bun run build`. All green before PR / `/finish-task`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: none — start immediately.
- **Foundational (P2)**: after Setup. Blocks **US1** only. **US2 does NOT depend on it.**
- **US1 (Phase 3)**: after Foundational. (TDD: T004–T007 before T008–T013.)
- **US2 (Phase 4)**: after Setup; independent of Foundational and US1. (TDD: T014 before T015–T018.)
- **Polish (Phase 5)**: after the desired stories complete.

### Critical within-story order

- US1: T004 → T008 (domain); T008 → T009 (service); T005 → T011; T006 → T012; T007 → T008/T009. T013 last (and before/after T018, never concurrent — same file).
- US2: T014 → T015 → T016; T017 anytime in US2; T018 last.

### Parallel Opportunities

- **US1 tests**: T004, T005, T006 in parallel (distinct files). T007 alongside (distinct file).
- **US1 messages**: T010, T011 in parallel (distinct files).
- **Cross-story**: All of US2 (T014–T017) can run in parallel with US1 — disjoint files. **Exception**: T013 and T018 both edit `chapters-edit-inline.spec.ts` → must be serialized.
- **T019** parallel with other polish reads; **T021** must be last.

## Parallel Example: US1 tests (RED phase)

```bash
Task: "Rewrite chapter-state-machine.spec.ts for the new matrix"   # T004
Task: "Update chapter-transitions.spec.ts messages/wrapper"        # T005
Task: "Add chapter-status-select.spec.tsx reachable-options test"  # T006
Task: "Extend integration chapter-update.spec.ts transitions"      # T007
```

## Implementation Strategy

### MVP (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational (constitution amendment + double review) → 3. Phase 3 US1 (TDD) → **STOP & VALIDATE** flexible status end-to-end → demo. This is the P1 value (unblocks the operator's reported pain).

### Incremental delivery

US1 (MVP) → add US2 (keyboard) in parallel/after → Polish/verify → PR via `/finish-task`.

---

## Notes

- TDD strict: each `[P]` test task must FAIL before its implementation task. `isValidTransition` must reach 100% unit coverage.
- No schema/migration, no new dependencies, no auto-commit.
- **REVISÃO DUPLA** is mandatory before merge (constitution amendment + financial guards) — T002 + T020.
- US2 is genuinely independent — if the constitution amendment review stalls, US2 can still land.
