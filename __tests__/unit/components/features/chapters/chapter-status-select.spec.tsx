// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChapterStatusSelect } from "@/components/features/chapters/chapter-status-select";
import type { ChapterStatus } from "@/lib/domain/chapter";

const LABELS: Record<ChapterStatus, string> = {
  pending: "Pendente",
  editing: "Em edição",
  reviewing: "Em revisão",
  retake: "Retake",
  completed: "Concluído",
  paid: "Pago",
};

function renderOpen(currentStatus: ChapterStatus) {
  render(
    <ChapterStatusSelect
      currentStatus={currentStatus}
      value={currentStatus}
      onChange={vi.fn()}
      defaultOpen
    />,
  );
}

async function isOptionDisabled(label: string): Promise<boolean> {
  const option = await screen.findByRole("option", { name: label });
  return option.getAttribute("aria-disabled") === "true" || option.hasAttribute("data-disabled");
}

describe("ChapterStatusSelect — reachableTargets topology", () => {
  describe("from a non-paid, non-completed status (e.g. editing)", () => {
    it("offers every non-paid status as enabled", async () => {
      renderOpen("editing");
      for (const status of ["pending", "editing", "reviewing", "retake", "completed"] as const) {
        expect(await isOptionDisabled(LABELS[status])).toBe(false);
      }
    });

    it("disables Pago (paid only reachable from completed)", async () => {
      renderOpen("editing");
      expect(await isOptionDisabled(LABELS.paid)).toBe(true);
    });
  });

  describe("from completed", () => {
    it("enables Pago alongside every non-paid status", async () => {
      renderOpen("completed");
      for (const status of [
        "pending",
        "editing",
        "reviewing",
        "retake",
        "completed",
        "paid",
      ] as const) {
        expect(await isOptionDisabled(LABELS[status])).toBe(false);
      }
    });
  });

  describe("from paid", () => {
    it("enables only Pago and Concluído", async () => {
      renderOpen("paid");
      expect(await isOptionDisabled(LABELS.paid)).toBe(false);
      expect(await isOptionDisabled(LABELS.completed)).toBe(false);
    });

    it("disables every non-paid status other than Concluído", async () => {
      renderOpen("paid");
      for (const status of ["pending", "editing", "reviewing", "retake"] as const) {
        expect(await isOptionDisabled(LABELS[status])).toBe(true);
      }
    });
  });
});
