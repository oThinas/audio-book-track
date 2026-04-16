import { describe, expect, it } from "vitest";

import {
  createNarratorSchema,
  narratorFormSchema,
  updateNarratorSchema,
} from "@/lib/domain/narrator";

describe("narratorFormSchema", () => {
  describe("name", () => {
    it("accepts a typical name", () => {
      const result = narratorFormSchema.safeParse({
        name: "João Silva",
        email: "joao@exemplo.com",
      });
      expect(result.success).toBe(true);
    });

    it("trims surrounding whitespace", () => {
      const result = narratorFormSchema.safeParse({
        name: "   Maria   ",
        email: "maria@exemplo.com",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Maria");
      }
    });

    it("rejects a name with less than 2 characters", () => {
      const result = narratorFormSchema.safeParse({
        name: "A",
        email: "a@exemplo.com",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Nome deve ter no mínimo 2 caracteres");
      }
    });

    it("rejects a name after trim that is too short", () => {
      const result = narratorFormSchema.safeParse({
        name: "  A  ",
        email: "a@exemplo.com",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a name with more than 100 characters", () => {
      const result = narratorFormSchema.safeParse({
        name: "x".repeat(101),
        email: "x@exemplo.com",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Nome deve ter no máximo 100 caracteres");
      }
    });

    it("accepts exactly 100 characters", () => {
      const result = narratorFormSchema.safeParse({
        name: "x".repeat(100),
        email: "x@exemplo.com",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("email", () => {
    it("accepts a valid email", () => {
      const result = narratorFormSchema.safeParse({
        name: "João",
        email: "joao@exemplo.com",
      });
      expect(result.success).toBe(true);
    });

    it("lowercases the email", () => {
      const result = narratorFormSchema.safeParse({
        name: "João",
        email: "JOAO@EXEMPLO.COM",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("joao@exemplo.com");
      }
    });

    it("trims the email", () => {
      const result = narratorFormSchema.safeParse({
        name: "João",
        email: "  joao@exemplo.com  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("joao@exemplo.com");
      }
    });

    it("rejects a malformed email", () => {
      const result = narratorFormSchema.safeParse({
        name: "João",
        email: "not-an-email",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("E-mail inválido");
      }
    });

    it("rejects an empty email", () => {
      const result = narratorFormSchema.safeParse({
        name: "João",
        email: "",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("createNarratorSchema", () => {
  it("is equivalent to narratorFormSchema (both fields required)", () => {
    const result = createNarratorSchema.safeParse({ name: "João" });
    expect(result.success).toBe(false);
  });

  it("accepts a complete payload", () => {
    const result = createNarratorSchema.safeParse({
      name: "João Silva",
      email: "joao@exemplo.com",
    });
    expect(result.success).toBe(true);
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

  it("accepts partial update of email only", () => {
    const result = updateNarratorSchema.safeParse({
      email: "novo@exemplo.com",
    });
    expect(result.success).toBe(true);
  });

  it("still validates provided fields", () => {
    const result = updateNarratorSchema.safeParse({ email: "invalid" });
    expect(result.success).toBe(false);
  });

  it("applies trim/lowercase to provided email", () => {
    const result = updateNarratorSchema.safeParse({
      email: "  NEW@MAIL.COM  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("new@mail.com");
    }
  });
});
