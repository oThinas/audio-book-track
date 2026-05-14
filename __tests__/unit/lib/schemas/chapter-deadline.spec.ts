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
  it("aceita deadline ausente (undefined)", () => {
    const result = updateChapterSchema.safeParse({ status: "pending" });
    expect(result.success).toBe(true);
  });

  it("aceita deadline = null", () => {
    const result = updateChapterSchema.safeParse({ deadline: null });
    expect(result.success).toBe(true);
  });

  it("aceita deadline = YYYY-MM-DD válido (futuro)", () => {
    const result = updateChapterSchema.safeParse({ deadline: "2026-06-15" });
    expect(result.success).toBe(true);
  });

  it("aceita deadline no passado (qualquer)", () => {
    const result = updateChapterSchema.safeParse({ deadline: "2020-01-01" });
    expect(result.success).toBe(true);
  });

  it("rejeita formato malformado (DD/MM/YYYY)", () => {
    const result = updateChapterSchema.safeParse({ deadline: "21/06/2026" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues.map((i) => i.message).join(" | ");
      expect(message.toLowerCase()).toMatch(/data limite/);
    }
  });

  it("rejeita data calendária inválida (2026-13-01)", () => {
    const result = updateChapterSchema.safeParse({ deadline: "2026-13-01" });
    expect(result.success).toBe(false);
  });

  it("rejeita data calendária inválida (2026-02-30)", () => {
    const result = updateChapterSchema.safeParse({ deadline: "2026-02-30" });
    expect(result.success).toBe(false);
  });

  it("rejeita string vazia", () => {
    const result = updateChapterSchema.safeParse({ deadline: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita data acima do teto de 10 anos", () => {
    const result = updateChapterSchema.safeParse({ deadline: "9999-12-31" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues.map((i) => i.message).join(" | ");
      expect(message.toLowerCase()).toMatch(/10 anos/);
    }
  });

  it("aceita data exatamente em hoje + 10 anos", () => {
    const result = updateChapterSchema.safeParse({ deadline: "2036-05-14" });
    expect(result.success).toBe(true);
  });
});
