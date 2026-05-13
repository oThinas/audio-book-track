import { describe, expect, it } from "vitest";

import { formatGroupedSeconds } from "@/lib/utils";

describe("formatGroupedSeconds", () => {
  it("returns '0min' for zero sum", () => {
    expect(formatGroupedSeconds(0)).toBe("0min");
  });

  it("returns 'Ymin' when there are only minutes (hours = 0)", () => {
    expect(formatGroupedSeconds(60)).toBe("1min");
    expect(formatGroupedSeconds(120)).toBe("2min");
    expect(formatGroupedSeconds(1380)).toBe("23min"); // 23min
  });

  it("returns 'Xh' when there are only exact hours (minutes = 0)", () => {
    expect(formatGroupedSeconds(3600)).toBe("1h");
    expect(formatGroupedSeconds(7200)).toBe("2h");
    expect(formatGroupedSeconds(10800)).toBe("3h");
  });

  it("returns 'Xh Ymin' when both are present", () => {
    expect(formatGroupedSeconds(5040)).toBe("1h 24min"); // 1h 24min = 3600 + 1440
    expect(formatGroupedSeconds(3660)).toBe("1h 1min");
    expect(formatGroupedSeconds(7320)).toBe("2h 2min");
  });

  it("truncates partial seconds (does not round minutes up)", () => {
    // 1h 1min 59s → "1h 1min" (not "1h 2min")
    expect(formatGroupedSeconds(3719)).toBe("1h 1min");
    // 59s → "0min" (not "1min")
    expect(formatGroupedSeconds(59)).toBe("0min");
  });

  it("does not accumulate error on large values", () => {
    // 100h exact → "100h"
    expect(formatGroupedSeconds(360_000)).toBe("100h");
    // 100h 30min
    expect(formatGroupedSeconds(361_800)).toBe("100h 30min");
  });

  it("throws for non-finite or negative input", () => {
    expect(() => formatGroupedSeconds(-1)).toThrow();
    expect(() => formatGroupedSeconds(Number.NaN)).toThrow();
    expect(() => formatGroupedSeconds(Number.POSITIVE_INFINITY)).toThrow();
  });
});
