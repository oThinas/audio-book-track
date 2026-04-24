import { describe, expect, it } from "vitest";

import {
  centsToReais,
  createStudioSchema,
  reaisToCents,
  studioFormSchema,
  updateStudioSchema,
} from "@/lib/domain/studio";

describe("studioFormSchema (UI reais)", () => {
  describe("name", () => {
    it("accepts a typical name", () => {
      const result = studioFormSchema.safeParse({
        name: "Sonora Studio",
        defaultHourlyRateReais: 85,
      });
      expect(result.success).toBe(true);
    });

    it("trims surrounding whitespace", () => {
      const result = studioFormSchema.safeParse({
        name: "   Sonora   ",
        defaultHourlyRateReais: 85,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Sonora");
      }
    });

    it("preserves case (no lowercasing)", () => {
      const result = studioFormSchema.safeParse({
        name: "SONORA",
        defaultHourlyRateReais: 85,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("SONORA");
      }
    });

    it("rejects a name with less than 2 characters", () => {
      const result = studioFormSchema.safeParse({ name: "A", defaultHourlyRateReais: 85 });
      expect(result.success).toBe(false);
    });

    it("rejects a name after trim that is too short", () => {
      const result = studioFormSchema.safeParse({ name: "  A  ", defaultHourlyRateReais: 85 });
      expect(result.success).toBe(false);
    });

    it("rejects a name with more than 100 characters", () => {
      const result = studioFormSchema.safeParse({
        name: "x".repeat(101),
        defaultHourlyRateReais: 85,
      });
      expect(result.success).toBe(false);
    });

    it("accepts exactly 100 characters", () => {
      const result = studioFormSchema.safeParse({
        name: "x".repeat(100),
        defaultHourlyRateReais: 85,
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = studioFormSchema.safeParse({ name: "", defaultHourlyRateReais: 85 });
      expect(result.success).toBe(false);
    });
  });

  describe("defaultHourlyRateReais", () => {
    it("accepts the lower bound R$ 0,01", () => {
      const result = studioFormSchema.safeParse({
        name: "Sonora",
        defaultHourlyRateReais: 0.01,
      });
      expect(result.success).toBe(true);
    });

    it("accepts the upper bound R$ 9.999,99", () => {
      const result = studioFormSchema.safeParse({
        name: "Sonora",
        defaultHourlyRateReais: 9999.99,
      });
      expect(result.success).toBe(true);
    });

    it("accepts a whole number (no decimals)", () => {
      const result = studioFormSchema.safeParse({
        name: "Sonora",
        defaultHourlyRateReais: 85,
      });
      expect(result.success).toBe(true);
    });

    it("accepts one decimal place", () => {
      const result = studioFormSchema.safeParse({
        name: "Sonora",
        defaultHourlyRateReais: 85.5,
      });
      expect(result.success).toBe(true);
    });

    it("accepts two decimal places", () => {
      const result = studioFormSchema.safeParse({
        name: "Sonora",
        defaultHourlyRateReais: 85.55,
      });
      expect(result.success).toBe(true);
    });

    it("rejects zero", () => {
      const result = studioFormSchema.safeParse({
        name: "Sonora",
        defaultHourlyRateReais: 0,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative values", () => {
      const result = studioFormSchema.safeParse({
        name: "Sonora",
        defaultHourlyRateReais: -1,
      });
      expect(result.success).toBe(false);
    });

    it("rejects value below lower bound (0.009)", () => {
      const result = studioFormSchema.safeParse({
        name: "Sonora",
        defaultHourlyRateReais: 0.009,
      });
      expect(result.success).toBe(false);
    });

    it("rejects value above upper bound (10000)", () => {
      const result = studioFormSchema.safeParse({
        name: "Sonora",
        defaultHourlyRateReais: 10000,
      });
      expect(result.success).toBe(false);
    });

    it("rejects more than 2 decimal places", () => {
      const result = studioFormSchema.safeParse({
        name: "Sonora",
        defaultHourlyRateReais: 85.555,
      });
      expect(result.success).toBe(false);
    });

    it("accepts a value that would fail strict multipleOf(0.01) due to floating-point (0.07 * 3)", () => {
      const value = 0.07 * 3;
      const result = studioFormSchema.safeParse({
        name: "Sonora",
        defaultHourlyRateReais: value,
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing defaultHourlyRateReais", () => {
      const result = studioFormSchema.safeParse({ name: "Sonora" });
      expect(result.success).toBe(false);
    });

    it("rejects non-number defaultHourlyRateReais", () => {
      const result = studioFormSchema.safeParse({
        name: "Sonora",
        defaultHourlyRateReais: "85",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("createStudioSchema (API cents)", () => {
  it("requires both name and defaultHourlyRateCents", () => {
    expect(createStudioSchema.safeParse({}).success).toBe(false);
    expect(createStudioSchema.safeParse({ name: "Sonora" }).success).toBe(false);
    expect(createStudioSchema.safeParse({ defaultHourlyRateCents: 8500 }).success).toBe(false);
  });

  it("accepts a complete valid payload", () => {
    const result = createStudioSchema.safeParse({
      name: "Sonora",
      defaultHourlyRateCents: 8500,
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-integer defaultHourlyRateCents", () => {
    const result = createStudioSchema.safeParse({
      name: "Sonora",
      defaultHourlyRateCents: 85.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects defaultHourlyRateCents = 0", () => {
    const result = createStudioSchema.safeParse({
      name: "Sonora",
      defaultHourlyRateCents: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts boundary integers (1 and 999_999)", () => {
    expect(createStudioSchema.safeParse({ name: "Min", defaultHourlyRateCents: 1 }).success).toBe(
      true,
    );
    expect(
      createStudioSchema.safeParse({ name: "Max", defaultHourlyRateCents: 999_999 }).success,
    ).toBe(true);
  });

  it("rejects defaultHourlyRateCents = 1_000_000", () => {
    const result = createStudioSchema.safeParse({
      name: "Over",
      defaultHourlyRateCents: 1_000_000,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateStudioSchema", () => {
  it("accepts an empty payload (idempotent)", () => {
    const result = updateStudioSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts only name", () => {
    const result = updateStudioSchema.safeParse({ name: "Sonora Plus" });
    expect(result.success).toBe(true);
  });

  it("accepts only defaultHourlyRateCents", () => {
    const result = updateStudioSchema.safeParse({ defaultHourlyRateCents: 10000 });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid value (same rules as createStudioSchema)", () => {
    const result = updateStudioSchema.safeParse({ defaultHourlyRateCents: 0 });
    expect(result.success).toBe(false);
  });
});

describe("reaisToCents / centsToReais conversion helpers", () => {
  it("converts reais to integer cents via Math.round", () => {
    expect(reaisToCents(85)).toBe(8500);
    expect(reaisToCents(85.5)).toBe(8550);
    expect(reaisToCents(85.55)).toBe(8555);
    expect(reaisToCents(0.01)).toBe(1);
    expect(reaisToCents(9999.99)).toBe(999999);
  });

  it("rounds floating-point imprecision (0.07 * 3 = 0.21000000000000002 → 21)", () => {
    expect(reaisToCents(0.07 * 3)).toBe(21);
  });

  it("converts integer cents back to reais", () => {
    expect(centsToReais(8500)).toBe(85);
    expect(centsToReais(8555)).toBe(85.55);
    expect(centsToReais(1)).toBe(0.01);
    expect(centsToReais(999999)).toBe(9999.99);
  });

  it("round-trip reais → cents → reais preserves 2-decimal values", () => {
    for (const value of [0.01, 0.5, 1, 85, 85.5, 85.55, 9999.99]) {
      expect(centsToReais(reaisToCents(value))).toBeCloseTo(value, 2);
    }
  });
});
