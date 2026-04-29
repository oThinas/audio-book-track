import { describe, expect, it } from "vitest";

import type { BookStatus } from "@/lib/domain/book";
import { computeBookStatus } from "@/lib/domain/book-status";

type Case = {
  readonly label: string;
  readonly statuses: ReadonlyArray<BookStatus>;
  readonly expected: BookStatus;
};

const cases: ReadonlyArray<Case> = [
  {
    label: "(a) all chapters paid → paid",
    statuses: ["paid", "paid", "paid"],
    expected: "paid",
  },
  {
    label: "(b) all completed/paid with at least one completed → completed",
    statuses: ["completed", "paid"],
    expected: "completed",
  },
  {
    label: "(b') all completed → completed",
    statuses: ["completed", "completed"],
    expected: "completed",
  },
  {
    label: "(c) any reviewing → reviewing",
    statuses: ["pending", "editing", "reviewing"],
    expected: "reviewing",
  },
  {
    label: "(c') any retake → reviewing (retake aggregates as reviewing at book level)",
    statuses: ["pending", "editing", "retake"],
    expected: "reviewing",
  },
  {
    label: "(c'') reviewing takes precedence over completed",
    statuses: ["completed", "reviewing"],
    expected: "reviewing",
  },
  {
    label: "(d) no reviewing/retake but at least one editing → editing",
    statuses: ["pending", "editing"],
    expected: "editing",
  },
  {
    label: "(d') editing takes precedence over completed when no reviewing/retake",
    statuses: ["completed", "editing"],
    expected: "editing",
  },
  {
    label: "(e) default pending when only pending chapters",
    statuses: ["pending", "pending"],
    expected: "pending",
  },
];

describe("computeBookStatus", () => {
  for (const { label, statuses, expected } of cases) {
    it(label, () => {
      const chapters = statuses.map((status) => ({ status }));
      expect(computeBookStatus(chapters)).toBe(expected);
    });
  }

  it("(f) throws when the chapter list is empty (invariant: a book without chapters is invalid)", () => {
    expect(() => computeBookStatus([])).toThrow(/sem capítulos/);
  });

  it("(g) after deleting a pending chapter, only paid remains → paid", () => {
    // Before: [pending, paid] → pending
    // User deletes the pending chapter
    // After: [paid] → paid
    const chapters = [{ status: "paid" as const }];
    expect(computeBookStatus(chapters)).toBe("paid");
  });

  it("(h) after adding a pending chapter to a book with one paid, result is pending", () => {
    // Before: [paid] → paid
    // User increases numChapters by 1
    // After: [paid, pending] → pending (default — no editing/reviewing/completed; not all paid)
    const chapters = [{ status: "paid" as const }, { status: "pending" as const }];
    expect(computeBookStatus(chapters)).toBe("pending");
  });

  it("accepts a single paid chapter", () => {
    expect(computeBookStatus([{ status: "paid" }])).toBe("paid");
  });

  it("accepts a single completed chapter", () => {
    expect(computeBookStatus([{ status: "completed" }])).toBe("completed");
  });

  it("accepts a single pending chapter", () => {
    expect(computeBookStatus([{ status: "pending" }])).toBe("pending");
  });
});
