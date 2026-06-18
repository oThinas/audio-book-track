# Quickstart: Manual Verification — Chapter Edit Flow

Prereqs: app running (`bun run dev`), logged in, a book with a few chapters open at its detail page.

## A. Flexible status (US1)

1. Double-click a `pending` chapter's status cell → status dropdown opens. Select **Em revisão**, press Save. → Row shows **Em revisão** (no intermediate step needed).
2. Edit the same chapter → set status back to **Pendente**, Save. → Saves (backward move allowed).
3. Edit a chapter that has **no narrator/editor/minutagem** → set status **Concluído**, Save. → Save blocked, message names the missing field (narrador → editor → minutagem, in that order). Row stays in its previous status.
4. Fill narrator + editor + minutagem (> 0) in the same edit, set **Concluído**, Save. → Saves as **Concluído**.
5. On that `completed` chapter → set **Pago**, Save. → Saves as **Pago**.
6. Open the status dropdown on a `pending`/`editing`/`reviewing`/`retake` chapter → **Pago** is disabled (not offered).
7. On the `paid` chapter → open status dropdown → only **Pago** and **Concluído** offered. Select **Concluído** → reversion confirmation dialog appears; confirm → reverts to **Concluído**.
8. On a `paid` chapter → try to change title/narrator/editor/minutagem/prazo → blocked (paid lock).

## B. Keyboard (US2)

1. Enter edit mode, focus the **title** field, press **Enter** → saves.
2. Focus the **status** trigger (closed), press **Enter** → saves.
3. Open the status dropdown, press **Enter** → highlighted option selected, dropdown closes, **not** saved. Press **Enter** again → saves.
4. Open the **prazo** calendar, press **Enter** → highlighted date picked, calendar closes, not saved.
5. Anywhere with nothing open, press **Esc** → edit cancels, row returns to view, no changes.
6. Open a dropdown, press **Esc** → dropdown closes, edit still open. Press **Esc** again → cancels.
7. Tab to **Cancelar**, press **Enter** → cancels (not save).
8. Clear the title, press **Enter** → validation error shown, not saved.

## C. Automated gates (final phase only)

```bash
bun run lint
bun run test:unit
bun run test:integration
bun run test:e2e        # keyboard + status flows changed → run
bun run build
```

## D. Governance (must not be skipped)

- Amend `.specify/memory/constitution.md` Principle III (lifecycle) to reflect free non-paid movement, field guards at `completed`/`paid`, `retake` unrestricted, `paid` as sole guarded status (bump MINOR → v2.18.0). **Double review** required (financial-model rule).
