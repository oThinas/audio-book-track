import { describe, expect, it } from "vitest";

import { createStudioSchema, studioFormSchema, updateStudioSchema } from "@/lib/domain/studio";

describe("studioFormSchema (cents-first UI)", () => {
  describe("name", () => {
    it("accepts a typical name", () => {
      const result = studioFormSchema.safeParse({
        name: "Sonora Studio",
        defaultHourlyRateCents: 8500,
      });
      expect(result.success).toBe(true);
    });

    it("trims surrounding whitespace", () => {
      const result = studioFormSchema.safeParse({
        name: "   Sonora   ",
        defaultHourlyRateCents: 8500,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Sonora");
      }
    });

    it("preserves case (no lowercasing)", () => {
      const result = studioFormSchema.safeParse({
        name: "SONORA",
        defaultHourlyRateCents: 8500,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("SONORA");
      }
    });

    it("rejects a name with less than 2 characters", () => {
      const result = studioFormSchema.safeParse({ name: "A", defaultHourlyRateCents: 8500 });
      expect(result.success).toBe(false);
    });

    it("rejects a name after trim that is too short", () => {
      const result = studioFormSchema.safeParse({ name: "  A  ", defaultHourlyRateCents: 8500 });
      expect(result.success).toBe(false);
    });

    it("rejects a name with more than 100 characters", () => {
      const result = studioFormSchema.safeParse({
        name: "x".repeat(101),
        defaultHourlyRateCents: 8500,
      });
      expect(result.success).toBe(false);
    });

    it("accepts exactly 100 characters", () => {
      const result = studioFormSchema.safeParse({
        name: "x".repeat(100),
        defaultHourlyRateCents: 8500,
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = studioFormSchema.safeParse({ name: "", defaultHourlyRateCents: 8500 });
      expect(result.success).toBe(false);
    });
  });
});

describe("createStudioSchema (cents-first)", () => {
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

  it("rejects negative defaultHourlyRateCents", () => {
    const result = createStudioSchema.safeParse({
      name: "Sonora",
      defaultHourlyRateCents: -1,
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

  it("rejects non-number defaultHourlyRateCents", () => {
    const result = createStudioSchema.safeParse({
      name: "Sonora",
      defaultHourlyRateCents: "8500",
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
    const result = updateStudioSchema.safeParse({ defaultHourlyRateCents: 10_000 });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid value (same rules as createStudioSchema)", () => {
    const result = updateStudioSchema.safeParse({ defaultHourlyRateCents: 0 });
    expect(result.success).toBe(false);
  });
});
