import { describe, expect, it } from "vitest";

import type { ChapterStatus } from "@/lib/domain/chapter";
import {
  computeChapterEarningsCents,
  countByStatus,
  formatStatusBreakdown,
  sumChapterEarningsCents,
  sumEditedSeconds,
} from "@/lib/domain/chapter-aggregation";

function chapter(
  partial: Partial<{
    editedSeconds: number;
    status: ChapterStatus;
  }> = {},
) {
  return {
    editedSeconds: 0,
    status: "pending" as ChapterStatus,
    ...partial,
  };
}

describe("computeChapterEarningsCents", () => {
  it("returns 0 when editedSeconds = 0", () => {
    expect(computeChapterEarningsCents({ editedSeconds: 0 }, { pricePerHourCents: 5_000 })).toBe(0);
  });

  it("applies the formula round(editedSeconds * pricePerHourCents / 3600)", () => {
    // 1h exact at 50.00/h → 5000 cents
    expect(computeChapterEarningsCents({ editedSeconds: 3600 }, { pricePerHourCents: 5_000 })).toBe(
      5_000,
    );
  });

  it("rounds half-away-from-zero per chapter (Principle II)", () => {
    // 30 min at 50.00/h → 2500 cents exact
    expect(computeChapterEarningsCents({ editedSeconds: 1800 }, { pricePerHourCents: 5_000 })).toBe(
      2_500,
    );
    // 1 second at 7300/h → 7300/3600 = 2.027... → round = 2
    expect(computeChapterEarningsCents({ editedSeconds: 1 }, { pricePerHourCents: 7_300 })).toBe(2);
  });
});

describe("sumChapterEarningsCents", () => {
  it("rounds PER CHAPTER before summing", () => {
    // Two chapters of 1s at 7300/h → each one rounds to 2 cents → sum = 4
    const chapters = [chapter({ editedSeconds: 1 }), chapter({ editedSeconds: 1 })];
    const result = sumChapterEarningsCents(chapters, { pricePerHourCents: 7_300 });
    expect(result).toBe(4);
    // Cannot be round(2 * 1 * 7300 / 3600) = round(4.055) = 4 by coincidence here;
    // force a case where half-away differs:
    // 3 chapters of 1s at 7300/h: individual = round(2.027) = 2 → sum 6;
    // vs round(3 * 7300 / 3600) = round(6.083) = 6 — matches. Let's prove it with 5400/h:
    // 1s at 5400/h: 1.5 → round half-away = 2; 2 chapters → sum 4;
    // round(2 * 5400 / 3600) = round(3) = 3 — differences emerge
    const chapters2 = [chapter({ editedSeconds: 1 }), chapter({ editedSeconds: 1 })];
    const result2 = sumChapterEarningsCents(chapters2, { pricePerHourCents: 5_400 });
    expect(result2).toBe(4); // 2 + 2, not 3
  });

  it("returns 0 for empty list", () => {
    expect(sumChapterEarningsCents([], { pricePerHourCents: 5_000 })).toBe(0);
  });

  it("returns 0 when all chapters have editedSeconds = 0", () => {
    const chapters = [chapter({ editedSeconds: 0 }), chapter({ editedSeconds: 0 })];
    expect(sumChapterEarningsCents(chapters, { pricePerHourCents: 5_000 })).toBe(0);
  });
});

describe("sumEditedSeconds", () => {
  it("sums editedSeconds for non-negative integers", () => {
    const chapters = [
      chapter({ editedSeconds: 100 }),
      chapter({ editedSeconds: 200 }),
      chapter({ editedSeconds: 300 }),
    ];
    expect(sumEditedSeconds(chapters)).toBe(600);
  });

  it("returns 0 for empty list", () => {
    expect(sumEditedSeconds([])).toBe(0);
  });

  it("ignores pending chapters (0 seconds)", () => {
    const chapters = [chapter({ editedSeconds: 0 }), chapter({ editedSeconds: 60 })];
    expect(sumEditedSeconds(chapters)).toBe(60);
  });
});

describe("countByStatus", () => {
  it("returns the full record with every status zeroed for an empty list", () => {
    expect(countByStatus([])).toEqual({
      pending: 0,
      editing: 0,
      reviewing: 0,
      retake: 0,
      completed: 0,
      paid: 0,
    });
  });

  it("counts each status correctly", () => {
    const chapters = [
      chapter({ status: "completed" }),
      chapter({ status: "completed" }),
      chapter({ status: "reviewing" }),
      chapter({ status: "paid" }),
    ];
    expect(countByStatus(chapters)).toEqual({
      pending: 0,
      editing: 0,
      reviewing: 1,
      retake: 0,
      completed: 2,
      paid: 1,
    });
  });

  it("sum of counts equals the list length", () => {
    const chapters = [
      chapter({ status: "pending" }),
      chapter({ status: "editing" }),
      chapter({ status: "completed" }),
    ];
    const counts = countByStatus(chapters);
    const total = Object.values(counts).reduce((acc, n) => acc + n, 0);
    expect(total).toBe(chapters.length);
  });
});

describe("formatStatusBreakdown", () => {
  it("returns only the count when the level dimension is status", () => {
    const breakdown = countByStatus([
      chapter({ status: "completed" }),
      chapter({ status: "completed" }),
      chapter({ status: "completed" }),
    ]);
    expect(formatStatusBreakdown(breakdown, "status")).toBe("3 capítulos");
  });

  it("uses the singular form when there is only 1 chapter (status dimension)", () => {
    const breakdown = countByStatus([chapter({ status: "paid" })]);
    expect(formatStatusBreakdown(breakdown, "status")).toBe("1 capítulo");
  });

  it("lists statuses with count > 0 separated by ' · ' in enum order", () => {
    const breakdown = countByStatus([
      chapter({ status: "completed" }),
      chapter({ status: "completed" }),
      chapter({ status: "completed" }),
      chapter({ status: "reviewing" }),
    ]);
    expect(formatStatusBreakdown(breakdown, null)).toBe("1 em revisão · 3 concluídos");
  });

  it("omits statuses with count 0", () => {
    const breakdown = countByStatus([chapter({ status: "pending" }), chapter({ status: "paid" })]);
    expect(formatStatusBreakdown(breakdown, null)).toBe("1 pendente · 1 pago");
  });

  it("returns empty string when all are zero (empty list)", () => {
    const breakdown = countByStatus([]);
    expect(formatStatusBreakdown(breakdown, null)).toBe("");
  });

  it("uses the correct singular/plural for each status", () => {
    const breakdown = countByStatus([
      chapter({ status: "pending" }),
      chapter({ status: "pending" }),
      chapter({ status: "editing" }),
      chapter({ status: "reviewing" }),
      chapter({ status: "reviewing" }),
      chapter({ status: "retake" }),
      chapter({ status: "completed" }),
      chapter({ status: "paid" }),
      chapter({ status: "paid" }),
      chapter({ status: "paid" }),
    ]);
    expect(formatStatusBreakdown(breakdown, null)).toBe(
      "2 pendentes · 1 em edição · 2 em revisão · 1 retake · 1 concluído · 3 pagos",
    );
  });

  it("for narrator/editor dimension, behaves like null (full breakdown)", () => {
    const breakdown = countByStatus([
      chapter({ status: "completed" }),
      chapter({ status: "reviewing" }),
    ]);
    const result = formatStatusBreakdown(breakdown, "narrator");
    expect(result).toBe("1 em revisão · 1 concluído");
    expect(result).toBe(formatStatusBreakdown(breakdown, "editor"));
    expect(result).toBe(formatStatusBreakdown(breakdown, null));
  });
});
