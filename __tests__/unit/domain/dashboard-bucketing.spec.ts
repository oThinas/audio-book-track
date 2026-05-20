import { describe, expect, it } from "vitest";

import { bucketDates, formatBucketLabel, inferGranularity } from "@/lib/domain/dashboard-bucketing";

describe("inferGranularity", () => {
  it("returns 'day' when range ≤ 31 days", () => {
    expect(
      inferGranularity({ fromIso: "2026-05-01", toIso: "2026-05-31", preset: "this-month" }),
    ).toBe("day");
    expect(inferGranularity({ fromIso: "2026-05-19", toIso: "2026-05-19", preset: "today" })).toBe(
      "day",
    );
  });

  it("returns 'week' when range is 32–180 days", () => {
    expect(
      inferGranularity({ fromIso: "2026-04-01", toIso: "2026-06-30", preset: "this-quarter" }),
    ).toBe("week");
  });

  it("returns 'month' when range ≥ 181 days", () => {
    expect(
      inferGranularity({ fromIso: "2026-01-01", toIso: "2026-12-31", preset: "this-year" }),
    ).toBe("month");
  });
});

describe("bucketDates", () => {
  it("generates a dense day-by-day bucket list", () => {
    const buckets = bucketDates(
      { fromIso: "2026-05-01", toIso: "2026-05-03", preset: "custom" },
      "day",
    );
    expect(buckets).toHaveLength(3);
    expect(buckets[0]).toEqual({ startIso: "2026-05-01", endIso: "2026-05-01" });
    expect(buckets[1]).toEqual({ startIso: "2026-05-02", endIso: "2026-05-02" });
    expect(buckets[2]).toEqual({ startIso: "2026-05-03", endIso: "2026-05-03" });
  });

  it("generates dense week buckets", () => {
    const buckets = bucketDates(
      { fromIso: "2026-05-01", toIso: "2026-05-31", preset: "custom" },
      "week",
    );
    expect(buckets.length).toBeGreaterThanOrEqual(4);
    expect(buckets.length).toBeLessThanOrEqual(6);
    expect(buckets[0].startIso <= "2026-05-01").toBe(true);
  });

  it("generates dense month buckets", () => {
    const buckets = bucketDates(
      { fromIso: "2026-01-01", toIso: "2026-12-31", preset: "this-year" },
      "month",
    );
    expect(buckets).toHaveLength(12);
    expect(buckets[0].startIso).toBe("2026-01-01");
    expect(buckets[11].startIso).toBe("2026-12-01");
  });
});

describe("formatBucketLabel", () => {
  it("formats day labels as DD/MM/YYYY (PT-BR)", () => {
    expect(formatBucketLabel({ startIso: "2026-05-12", endIso: "2026-05-12" }, "day")).toBe(
      "12/05/2026",
    );
  });

  it("formats month labels as 'Mês YYYY' (PT-BR)", () => {
    expect(formatBucketLabel({ startIso: "2026-05-01", endIso: "2026-05-31" }, "month")).toMatch(
      /^[A-Za-zçÇ]+ 2026$/,
    );
  });

  it("formats week labels as 'Semana de DD–DD/MM/YYYY'", () => {
    const label = formatBucketLabel({ startIso: "2026-05-11", endIso: "2026-05-17" }, "week");
    expect(label).toContain("Semana de");
    expect(label).toContain("2026");
  });
});
