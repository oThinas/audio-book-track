import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { updateChapterSchema } from "@/lib/schemas/chapter";

const FIXED_NOW = new Date("2026-05-14T15:00:00.000Z");

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

describe("updateChapterSchema — deadline", () => {
  it("accepts an absent deadline (undefined)", () => {
    const result = updateChapterSchema.safeParse({ status: "pending" });
    expect(result.success).toBe(true);
  });

  it("accepts deadline = null", () => {
    const result = updateChapterSchema.safeParse({ deadline: null });
    expect(result.success).toBe(true);
  });

  it("accepts a valid YYYY-MM-DD deadline in the future", () => {
    const result = updateChapterSchema.safeParse({ deadline: "2026-06-15" });
    expect(result.success).toBe(true);
  });

  it("accepts any deadline in the past", () => {
    const result = updateChapterSchema.safeParse({ deadline: "2020-01-01" });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed deadline (DD/MM/YYYY)", () => {
    const result = updateChapterSchema.safeParse({ deadline: "21/06/2026" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues.map((i) => i.message).join(" | ");
      expect(message.toLowerCase()).toMatch(/data limite/);
    }
  });

  it("rejects an invalid calendar date (2026-13-01)", () => {
    const result = updateChapterSchema.safeParse({ deadline: "2026-13-01" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid calendar date (2026-02-30)", () => {
    const result = updateChapterSchema.safeParse({ deadline: "2026-02-30" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = updateChapterSchema.safeParse({ deadline: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a deadline beyond the 10-year ceiling", () => {
    const result = updateChapterSchema.safeParse({ deadline: "9999-12-31" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues.map((i) => i.message).join(" | ");
      expect(message.toLowerCase()).toMatch(/10 anos/);
    }
  });

  it("accepts a deadline exactly at today + 10 years", () => {
    const result = updateChapterSchema.safeParse({ deadline: "2036-05-14" });
    expect(result.success).toBe(true);
  });
});
