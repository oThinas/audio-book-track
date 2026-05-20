import { describe, expect, it } from "vitest";

import { densifyBuckets, ticketMedioCents } from "@/lib/domain/earnings-aggregations";

describe("densifyBuckets", () => {
  it("fills missing buckets with zero", () => {
    const buckets = [
      { startIso: "2026-05-01", endIso: "2026-05-01" },
      { startIso: "2026-05-02", endIso: "2026-05-02" },
      { startIso: "2026-05-03", endIso: "2026-05-03" },
    ];
    const sparse = [{ startIso: "2026-05-02", cents: 5000 }];
    expect(densifyBuckets(buckets, sparse)).toEqual([
      { startIso: "2026-05-01", endIso: "2026-05-01", cents: 0 },
      { startIso: "2026-05-02", endIso: "2026-05-02", cents: 5000 },
      { startIso: "2026-05-03", endIso: "2026-05-03", cents: 0 },
    ]);
  });

  it("preserves bucket order", () => {
    const buckets = [
      { startIso: "2026-01-01", endIso: "2026-01-31" },
      { startIso: "2026-02-01", endIso: "2026-02-28" },
    ];
    const sparse = [{ startIso: "2026-02-01", cents: 7777 }];
    const result = densifyBuckets(buckets, sparse);
    expect(result[0].startIso).toBe("2026-01-01");
    expect(result[1].startIso).toBe("2026-02-01");
    expect(result[1].cents).toBe(7777);
  });

  it("zero buckets stay zero when sparse list is empty", () => {
    const buckets = [{ startIso: "2026-05-01", endIso: "2026-05-01" }];
    expect(densifyBuckets(buckets, [])).toEqual([
      { startIso: "2026-05-01", endIso: "2026-05-01", cents: 0 },
    ]);
  });
});

describe("ticketMedioCents", () => {
  it("returns round(total / count) when count > 0", () => {
    expect(ticketMedioCents(15000, 5)).toBe(3000);
    expect(ticketMedioCents(10001, 3)).toBe(3334);
  });

  it("returns 0 when count is 0 (no divide-by-zero)", () => {
    expect(ticketMedioCents(0, 0)).toBe(0);
    expect(ticketMedioCents(9999, 0)).toBe(0);
  });
});
