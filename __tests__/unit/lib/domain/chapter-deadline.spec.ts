import { describe, expect, it } from "vitest";

import type { Chapter, ChapterStatus } from "@/lib/domain/chapter";
import { type FocusWeekContext, isInFocusWeek, isOverdue } from "@/lib/domain/chapter-deadline";

const ctx: FocusWeekContext = {
  todayIso: "2026-05-14", // quinta-feira
  mondayIso: "2026-05-11",
  sundayIso: "2026-05-17",
};

function buildChapter(overrides: { status: ChapterStatus; deadline: string | null }): Chapter {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    bookId: "00000000-0000-0000-0000-000000000010",
    number: 1,
    status: overrides.status,
    narratorId: null,
    editorId: null,
    editedSeconds: 0,
    deadline: overrides.deadline,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
  };
}

const STATUSES: readonly ChapterStatus[] = [
  "pending",
  "editing",
  "reviewing",
  "retake",
  "completed",
  "paid",
];

const ACTIVE_STATUSES: ReadonlySet<ChapterStatus> = new Set([
  "pending",
  "editing",
  "reviewing",
  "retake",
]);

describe("isOverdue", () => {
  it("retorna false para capítulo sem prazo, em qualquer status", () => {
    for (const status of STATUSES) {
      expect(isOverdue(buildChapter({ status, deadline: null }), ctx)).toBe(false);
    }
  });

  it("retorna true apenas quando deadline < hoje E status é ativo", () => {
    for (const status of STATUSES) {
      const chapter = buildChapter({ status, deadline: "2026-05-13" }); // ontem
      const expected = ACTIVE_STATUSES.has(status);
      expect(isOverdue(chapter, ctx)).toBe(expected);
    }
  });

  it("retorna false quando deadline = hoje (não é passado)", () => {
    for (const status of STATUSES) {
      expect(isOverdue(buildChapter({ status, deadline: "2026-05-14" }), ctx)).toBe(false);
    }
  });

  it("retorna false quando deadline é no futuro", () => {
    for (const status of STATUSES) {
      expect(isOverdue(buildChapter({ status, deadline: "2026-05-20" }), ctx)).toBe(false);
    }
  });
});

describe("isInFocusWeek", () => {
  it("retorna false quando deadline é null (qualquer status)", () => {
    for (const status of STATUSES) {
      expect(isInFocusWeek(buildChapter({ status, deadline: null }), ctx)).toBe(false);
    }
  });

  it("retorna true para atrasado em status ativo", () => {
    for (const status of STATUSES) {
      const chapter = buildChapter({ status, deadline: "2026-05-10" }); // antes da semana
      const expected = ACTIVE_STATUSES.has(status);
      expect(isInFocusWeek(chapter, ctx)).toBe(expected);
    }
  });

  it("retorna true para prazo na segunda da semana, em status ativo", () => {
    for (const status of STATUSES) {
      const chapter = buildChapter({ status, deadline: "2026-05-11" });
      const expected = ACTIVE_STATUSES.has(status);
      expect(isInFocusWeek(chapter, ctx)).toBe(expected);
    }
  });

  it("retorna true para prazo no domingo da semana, em status ativo", () => {
    for (const status of STATUSES) {
      const chapter = buildChapter({ status, deadline: "2026-05-17" });
      const expected = ACTIVE_STATUSES.has(status);
      expect(isInFocusWeek(chapter, ctx)).toBe(expected);
    }
  });

  it("retorna false para prazo na próxima segunda (fora da semana)", () => {
    for (const status of STATUSES) {
      expect(isInFocusWeek(buildChapter({ status, deadline: "2026-05-18" }), ctx)).toBe(false);
    }
  });

  it("retorna false para completed/paid mesmo se na semana ou atrasado", () => {
    expect(isInFocusWeek(buildChapter({ status: "completed", deadline: "2026-05-14" }), ctx)).toBe(
      false,
    );
    expect(isInFocusWeek(buildChapter({ status: "paid", deadline: "2026-05-10" }), ctx)).toBe(
      false,
    );
  });

  it("retorna true para prazo igual a hoje em status ativo", () => {
    for (const status of STATUSES) {
      const chapter = buildChapter({ status, deadline: "2026-05-14" });
      const expected = ACTIVE_STATUSES.has(status);
      expect(isInFocusWeek(chapter, ctx)).toBe(expected);
    }
  });
});
