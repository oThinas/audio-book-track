import { describe, expect, it } from "vitest";

import {
  createNarratorSchema,
  narratorFormSchema,
  updateNarratorSchema,
} from "@/lib/domain/narrator";

describe("narratorFormSchema", () => {
  describe("name", () => {
    it("accepts a typical name", () => {
      const result = narratorFormSchema.safeParse({ name: "João Silva" });
      expect(result.success).toBe(true);
    });

    it("trims surrounding whitespace", () => {
      const result = narratorFormSchema.safeParse({ name: "   Maria   " });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Maria");
      }
    });

    it("preserves case (no lowercasing)", () => {
      const result = narratorFormSchema.safeParse({ name: "JOÃO" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("JOÃO");
      }
    });

    it("rejects a name with less than 2 characters", () => {
      const result = narratorFormSchema.safeParse({ name: "A" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Nome deve ter no mínimo 2 caracteres");
      }
    });

    it("rejects a name after trim that is too short", () => {
      const result = narratorFormSchema.safeParse({ name: "  A  " });
      expect(result.success).toBe(false);
    });

    it("rejects a name with more than 100 characters", () => {
      const result = narratorFormSchema.safeParse({ name: "x".repeat(101) });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Nome deve ter no máximo 100 caracteres");
      }
    });

    it("accepts exactly 100 characters", () => {
      const result = narratorFormSchema.safeParse({ name: "x".repeat(100) });
      expect(result.success).toBe(true);
    });
  });

  describe("legacy email field", () => {
    it("silently discards email when present (schema no longer declares the field)", () => {
      const result = narratorFormSchema.safeParse({
        name: "João",
        email: "legacy@example.com",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: "João" });
        expect(result.data).not.toHaveProperty("email");
      }
    });
  });
});

describe("createNarratorSchema", () => {
  it("requires name", () => {
    const result = createNarratorSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts a payload with only name", () => {
    const result = createNarratorSchema.safeParse({ name: "João Silva" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "João Silva" });
    }
  });

  it("silently discards an extra email field", () => {
    const result = createNarratorSchema.safeParse({
      name: "João",
      email: "legacy@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("email");
    }
  });
});

describe("updateNarratorSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    const result = updateNarratorSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts partial update of name only", () => {
    const result = updateNarratorSchema.safeParse({ name: "Novo Nome" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "Novo Nome" });
    }
  });

  it("still validates the provided name", () => {
    const result = updateNarratorSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });

  it("silently discards an extra email field in PATCH payloads", () => {
    const result = updateNarratorSchema.safeParse({
      name: "Novo",
      email: "legacy@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "Novo" });
      expect(result.data).not.toHaveProperty("email");
    }
  });
});
