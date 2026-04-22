import { describe, expect, it } from "vitest";

import { createStudioSchema, studioFormSchema, updateStudioSchema } from "@/lib/domain/studio";

describe("studioFormSchema", () => {
  describe("name", () => {
    it("accepts a typical name", () => {
      const result = studioFormSchema.safeParse({ name: "Sonora Studio", defaultHourlyRate: 85 });
      expect(result.success).toBe(true);
    });

    it("trims surrounding whitespace", () => {
      const result = studioFormSchema.safeParse({
        name: "   Sonora   ",
        defaultHourlyRate: 85,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Sonora");
      }
    });

    it("preserves case (no lowercasing)", () => {
      const result = studioFormSchema.safeParse({ name: "SONORA", defaultHourlyRate: 85 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("SONORA");
      }
    });

    it("rejects a name with less than 2 characters", () => {
      const result = studioFormSchema.safeParse({ name: "A", defaultHourlyRate: 85 });
      expect(result.success).toBe(false);
    });

    it("rejects a name after trim that is too short", () => {
      const result = studioFormSchema.safeParse({ name: "  A  ", defaultHourlyRate: 85 });
      expect(result.success).toBe(false);
    });

    it("rejects a name with more than 100 characters", () => {
      const result = studioFormSchema.safeParse({
        name: "x".repeat(101),
        defaultHourlyRate: 85,
      });
      expect(result.success).toBe(false);
    });

    it("accepts exactly 100 characters", () => {
      const result = studioFormSchema.safeParse({
        name: "x".repeat(100),
        defaultHourlyRate: 85,
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = studioFormSchema.safeParse({ name: "", defaultHourlyRate: 85 });
      expect(result.success).toBe(false);
    });
  });

  describe("defaultHourlyRate", () => {
    it("accepts the lower bound R$ 0,01", () => {
      const result = studioFormSchema.safeParse({ name: "Sonora", defaultHourlyRate: 0.01 });
      expect(result.success).toBe(true);
    });

    it("accepts the upper bound R$ 9.999,99", () => {
      const result = studioFormSchema.safeParse({ name: "Sonora", defaultHourlyRate: 9999.99 });
      expect(result.success).toBe(true);
    });

    it("accepts a whole number (no decimals)", () => {
      const result = studioFormSchema.safeParse({ name: "Sonora", defaultHourlyRate: 85 });
      expect(result.success).toBe(true);
    });

    it("accepts one decimal place", () => {
      const result = studioFormSchema.safeParse({ name: "Sonora", defaultHourlyRate: 85.5 });
      expect(result.success).toBe(true);
    });

    it("accepts two decimal places", () => {
      const result = studioFormSchema.safeParse({ name: "Sonora", defaultHourlyRate: 85.55 });
      expect(result.success).toBe(true);
    });

    it("rejects zero", () => {
      const result = studioFormSchema.safeParse({ name: "Sonora", defaultHourlyRate: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects negative values", () => {
      const result = studioFormSchema.safeParse({ name: "Sonora", defaultHourlyRate: -1 });
      expect(result.success).toBe(false);
    });

    it("rejects value below lower bound (0.009)", () => {
      const result = studioFormSchema.safeParse({ name: "Sonora", defaultHourlyRate: 0.009 });
      expect(result.success).toBe(false);
    });

    it("rejects value above upper bound (10000)", () => {
      const result = studioFormSchema.safeParse({ name: "Sonora", defaultHourlyRate: 10000 });
      expect(result.success).toBe(false);
    });

    it("rejects more than 2 decimal places", () => {
      const result = studioFormSchema.safeParse({ name: "Sonora", defaultHourlyRate: 85.555 });
      expect(result.success).toBe(false);
    });

    it("accepts a value that would fail strict multipleOf(0.01) due to floating-point (0.07 * 3)", () => {
      const value = 0.07 * 3;
      const result = studioFormSchema.safeParse({ name: "Sonora", defaultHourlyRate: value });
      expect(result.success).toBe(true);
    });

    it("rejects missing defaultHourlyRate", () => {
      const result = studioFormSchema.safeParse({ name: "Sonora" });
      expect(result.success).toBe(false);
    });

    it("rejects non-number defaultHourlyRate", () => {
      const result = studioFormSchema.safeParse({ name: "Sonora", defaultHourlyRate: "85" });
      expect(result.success).toBe(false);
    });
  });
});

describe("createStudioSchema", () => {
  it("requires both name and defaultHourlyRate", () => {
    expect(createStudioSchema.safeParse({}).success).toBe(false);
    expect(createStudioSchema.safeParse({ name: "Sonora" }).success).toBe(false);
    expect(createStudioSchema.safeParse({ defaultHourlyRate: 85 }).success).toBe(false);
  });

  it("accepts a complete valid payload", () => {
    const result = createStudioSchema.safeParse({ name: "Sonora", defaultHourlyRate: 85 });
    expect(result.success).toBe(true);
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

  it("accepts only defaultHourlyRate", () => {
    const result = updateStudioSchema.safeParse({ defaultHourlyRate: 100 });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid value (same rules as createStudioSchema)", () => {
    const result = updateStudioSchema.safeParse({ defaultHourlyRate: 0 });
    expect(result.success).toBe(false);
  });
});
