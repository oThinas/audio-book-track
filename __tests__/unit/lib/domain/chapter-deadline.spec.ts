import { describe, expect, it } from "vitest";

import type { Chapter, ChapterStatus } from "@/lib/domain/chapter";
import { type FocusWeekContext, isInFocusWeek, isOverdue } from "@/lib/domain/chapter-deadline";

const ctx: FocusWeekContext = {
  todayIso: "2026-05-14", // Thursday
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
  it("returns false for a chapter without a deadline, regardless of status", () => {
    for (const status of STATUSES) {
      expect(isOverdue(buildChapter({ status, deadline: null }), ctx)).toBe(false);
    }
  });

  it("returns true only when deadline < today AND status is active", () => {
    for (const status of STATUSES) {
      const chapter = buildChapter({ status, deadline: "2026-05-13" }); // yesterday
      const expected = ACTIVE_STATUSES.has(status);
      expect(isOverdue(chapter, ctx)).toBe(expected);
    }
  });

  it("returns false when deadline equals today (not in the past)", () => {
    for (const status of STATUSES) {
      expect(isOverdue(buildChapter({ status, deadline: "2026-05-14" }), ctx)).toBe(false);
    }
  });

  it("returns false when deadline is in the future", () => {
    for (const status of STATUSES) {
      expect(isOverdue(buildChapter({ status, deadline: "2026-05-20" }), ctx)).toBe(false);
    }
  });
});

describe("isInFocusWeek", () => {
  it("returns false when deadline is null (any status)", () => {
    for (const status of STATUSES) {
      expect(isInFocusWeek(buildChapter({ status, deadline: null }), ctx)).toBe(false);
    }
  });

  it("returns true for overdue chapters in an active status", () => {
    for (const status of STATUSES) {
      const chapter = buildChapter({ status, deadline: "2026-05-10" }); // before the week
      const expected = ACTIVE_STATUSES.has(status);
      expect(isInFocusWeek(chapter, ctx)).toBe(expected);
    }
  });

  it("returns true for a deadline on Monday of the current week in an active status", () => {
    for (const status of STATUSES) {
      const chapter = buildChapter({ status, deadline: "2026-05-11" });
      const expected = ACTIVE_STATUSES.has(status);
      expect(isInFocusWeek(chapter, ctx)).toBe(expected);
    }
  });

  it("returns true for a deadline on Sunday of the current week in an active status", () => {
    for (const status of STATUSES) {
      const chapter = buildChapter({ status, deadline: "2026-05-17" });
      const expected = ACTIVE_STATUSES.has(status);
      expect(isInFocusWeek(chapter, ctx)).toBe(expected);
    }
  });

  it("returns false for a deadline on the next Monday (outside the week)", () => {
    for (const status of STATUSES) {
      expect(isInFocusWeek(buildChapter({ status, deadline: "2026-05-18" }), ctx)).toBe(false);
    }
  });

  it("returns false for completed/paid even when inside the week or overdue", () => {
    expect(isInFocusWeek(buildChapter({ status: "completed", deadline: "2026-05-14" }), ctx)).toBe(
      false,
    );
    expect(isInFocusWeek(buildChapter({ status: "paid", deadline: "2026-05-10" }), ctx)).toBe(
      false,
    );
  });

  it("returns true for a deadline equal to today in an active status", () => {
    for (const status of STATUSES) {
      const chapter = buildChapter({ status, deadline: "2026-05-14" });
      const expected = ACTIVE_STATUSES.has(status);
      expect(isInFocusWeek(chapter, ctx)).toBe(expected);
    }
  });
});
