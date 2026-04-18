import { describe, expect, it } from "vitest";

import { createEditorSchema, editorFormSchema, updateEditorSchema } from "@/lib/domain/editor";

describe("editorFormSchema", () => {
  describe("name", () => {
    it("accepts a typical name", () => {
      const result = editorFormSchema.safeParse({ name: "Carla Mendes", email: "a@b.com" });
      expect(result.success).toBe(true);
    });

    it("trims surrounding whitespace", () => {
      const result = editorFormSchema.safeParse({ name: "   Maria   ", email: "a@b.com" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Maria");
      }
    });

    it("preserves case (no lowercasing)", () => {
      const result = editorFormSchema.safeParse({ name: "CARLA", email: "a@b.com" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("CARLA");
      }
    });

    it("rejects a name with less than 2 characters", () => {
      const result = editorFormSchema.safeParse({ name: "A", email: "a@b.com" });
      expect(result.success).toBe(false);
    });

    it("rejects a name after trim that is too short", () => {
      const result = editorFormSchema.safeParse({ name: "  A  ", email: "a@b.com" });
      expect(result.success).toBe(false);
    });

    it("rejects a name with more than 100 characters", () => {
      const result = editorFormSchema.safeParse({ name: "x".repeat(101), email: "a@b.com" });
      expect(result.success).toBe(false);
    });

    it("accepts exactly 100 characters", () => {
      const result = editorFormSchema.safeParse({ name: "x".repeat(100), email: "a@b.com" });
      expect(result.success).toBe(true);
    });
  });

  describe("email", () => {
    it("accepts a typical email", () => {
      const result = editorFormSchema.safeParse({ name: "Carla", email: "carla@studio.com" });
      expect(result.success).toBe(true);
    });

    it("trims surrounding whitespace from email", () => {
      const result = editorFormSchema.safeParse({
        name: "Carla",
        email: "  carla@studio.com  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("carla@studio.com");
      }
    });

    it("preserves email case (normalization happens in the service)", () => {
      const result = editorFormSchema.safeParse({
        name: "Carla",
        email: "Carla@Studio.com",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("Carla@Studio.com");
      }
    });

    it("rejects an empty email", () => {
      const result = editorFormSchema.safeParse({ name: "Carla", email: "" });
      expect(result.success).toBe(false);
    });

    it("rejects a malformed email", () => {
      const result = editorFormSchema.safeParse({ name: "Carla", email: "not-an-email" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("E-mail inválido");
      }
    });

    it("rejects an email longer than 255 characters", () => {
      const longLocal = "a".repeat(251);
      const email = `${longLocal}@b.co`;
      expect(email.length).toBe(256);
      const result = editorFormSchema.safeParse({ name: "Carla", email });
      expect(result.success).toBe(false);
    });
  });
});

describe("createEditorSchema", () => {
  it("requires name and email", () => {
    expect(createEditorSchema.safeParse({}).success).toBe(false);
    expect(createEditorSchema.safeParse({ name: "Carla" }).success).toBe(false);
    expect(createEditorSchema.safeParse({ email: "c@s.com" }).success).toBe(false);
  });

  it("accepts a payload with name and email", () => {
    const result = createEditorSchema.safeParse({ name: "Carla", email: "c@s.com" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "Carla", email: "c@s.com" });
    }
  });

  it("silently discards unknown keys", () => {
    const result = createEditorSchema.safeParse({
      name: "Carla",
      email: "c@s.com",
      extra: "ignored",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("extra");
    }
  });
});

describe("updateEditorSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(updateEditorSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial update of name only", () => {
    const result = updateEditorSchema.safeParse({ name: "Novo Nome" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "Novo Nome" });
    }
  });

  it("accepts partial update of email only", () => {
    const result = updateEditorSchema.safeParse({ email: "novo@x.com" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ email: "novo@x.com" });
    }
  });

  it("still validates the provided name", () => {
    expect(updateEditorSchema.safeParse({ name: "A" }).success).toBe(false);
  });

  it("still validates the provided email", () => {
    expect(updateEditorSchema.safeParse({ email: "invalid" }).success).toBe(false);
  });

  it("silently discards unknown keys", () => {
    const result = updateEditorSchema.safeParse({ name: "Carla", extra: "ignored" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("extra");
    }
  });
});
