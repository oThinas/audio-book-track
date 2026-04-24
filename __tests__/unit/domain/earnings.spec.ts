import { describe, expect, it } from "vitest";

import { computeEarningsCents, sumEarningsCents } from "@/lib/domain/earnings";

describe("computeEarningsCents", () => {
  it("returns 0 when edited seconds are 0", () => {
    expect(computeEarningsCents(0, 7500)).toBe(0);
  });

  it("returns 0 when price per hour is 0", () => {
    expect(computeEarningsCents(3600, 0)).toBe(0);
  });

  it("computes 1 hour * R$ 75/h = 7500 cents (R$ 75,00)", () => {
    expect(computeEarningsCents(3600, 7500)).toBe(7500);
  });

  it("computes 2 hours * R$ 75/h = 15000 cents (R$ 150,00)", () => {
    expect(computeEarningsCents(7200, 7500)).toBe(15000);
  });

  it("computes 30 minutes * R$ 75/h = 3750 cents (R$ 37,50)", () => {
    expect(computeEarningsCents(1800, 7500)).toBe(3750);
  });

  it("rounds half-away-from-zero when the division is not exact", () => {
    // 3601 seconds * 7500 cents / 3600 = 7502.083... → 7502
    expect(computeEarningsCents(3601, 7500)).toBe(7502);
    // 3599 seconds * 7500 cents / 3600 = 7497.916... → 7498
    expect(computeEarningsCents(3599, 7500)).toBe(7498);
  });

  it("matches Math.round semantics for ties (half → nearest away from zero)", () => {
    // 1 second * 7200 cents / 3600 = 2.0 exact → 2
    expect(computeEarningsCents(1, 7200)).toBe(2);
    // 1 second * 3600 cents / 3600 = 1.0 exact → 1
    expect(computeEarningsCents(1, 3600)).toBe(1);
    // 1 second * 1800 cents / 3600 = 0.5 → Math.round → 1
    expect(computeEarningsCents(1, 1800)).toBe(1);
  });

  it("produces the same result as the SQL formula documented in data-model.md", () => {
    // ROUND((edited_seconds::numeric * price_per_hour_cents) / 3600)
    // For (editedSeconds=7200, pricePerHourCents=8550): 7200 * 8550 / 3600 = 17100
    expect(computeEarningsCents(7200, 8550)).toBe(17100);
  });

  it("handles maximum documented values without overflow", () => {
    // edited_seconds max = 3_600_000 (1000 h), price_per_hour_cents max = 999_999 (R$ 9.999,99/h)
    // result = 3_600_000 * 999_999 / 3600 = 999_999_000 cents = R$ 9.999.990,00
    expect(computeEarningsCents(3_600_000, 999_999)).toBe(999_999_000);
  });

  it("throws when editedSeconds is negative", () => {
    expect(() => computeEarningsCents(-1, 7500)).toThrow();
  });

  it("throws when editedSeconds is not an integer", () => {
    expect(() => computeEarningsCents(1.5, 7500)).toThrow();
  });

  it("throws when pricePerHourCents is negative", () => {
    expect(() => computeEarningsCents(3600, -1)).toThrow();
  });

  it("throws when pricePerHourCents is not an integer", () => {
    expect(() => computeEarningsCents(3600, 7500.5)).toThrow();
  });
});

describe("sumEarningsCents", () => {
  it("returns 0 for an empty list", () => {
    expect(sumEarningsCents([])).toBe(0);
  });

  it("sums single-row earnings", () => {
    expect(sumEarningsCents([{ editedSeconds: 3600, pricePerHourCents: 7500 }])).toBe(7500);
  });

  it("sums per-row rounded earnings (auditable Principle II)", () => {
    // Each row rounds individually — summing per-row results is the auditable
    // path chosen in data-model.md so the SQL and JS produce identical values.
    // 3601 * 7500 / 3600 = 7502 (rounded)
    // 3599 * 7500 / 3600 = 7498 (rounded)
    // sum = 15000
    expect(
      sumEarningsCents([
        { editedSeconds: 3601, pricePerHourCents: 7500 },
        { editedSeconds: 3599, pricePerHourCents: 7500 },
      ]),
    ).toBe(15000);
  });

  it("sums mixed prices per row (reflecting different book contexts)", () => {
    // row1: 7200 s * 7500 / 3600 = 15000
    // row2: 3600 s * 10000 / 3600 = 10000
    // total: 25000
    expect(
      sumEarningsCents([
        { editedSeconds: 7200, pricePerHourCents: 7500 },
        { editedSeconds: 3600, pricePerHourCents: 10000 },
      ]),
    ).toBe(25000);
  });
});
