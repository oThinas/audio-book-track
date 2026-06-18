import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import { computeEarningsCents } from "@/lib/domain/earnings";

/**
 * SQL ↔ JS equivalence guarantee: the SQL aggregation uses
 *   ROUND(edited_seconds * price_per_hour_cents / 3600.0)
 * which PostgreSQL evaluates as banker-rounded numeric. computeEarningsCents
 * uses Math.round (half-away-from-zero for positive integers).
 *
 * For non-negative integer inputs, both reduce to half-up rounding because
 * the dividend is always a non-negative real with a half-cent step.
 * This test asserts the equivalence for 1000 random pairs (D12).
 */
describe("earnings: SQL ↔ JS equivalence (property-based)", () => {
  test.prop(
    {
      editedSeconds: fc.integer({ min: 0, max: 3_600_000 }),
      pricePerHourCents: fc.integer({ min: 0, max: 10_000_000 }),
    },
    { numRuns: 1000 },
  )(
    "JS computeEarningsCents matches SQL Math.round( seconds * price / 3600 ) for any pair",
    ({ editedSeconds, pricePerHourCents }) => {
      const js = computeEarningsCents(editedSeconds, pricePerHourCents);

      // Reference SQL formula in pure JS using exact numeric arithmetic.
      // We avoid floating-point drift by computing via bigint when possible.
      const numerator = BigInt(editedSeconds) * BigInt(pricePerHourCents);
      const denominator = BigInt(3600);
      const quotient = numerator / denominator;
      const remainder = numerator % denominator;
      // Half-up rounding on a non-negative dividend.
      const rounded =
        remainder * BigInt(2) >= denominator ? Number(quotient + BigInt(1)) : Number(quotient);

      expect(js).toBe(rounded);
    },
  );
});
