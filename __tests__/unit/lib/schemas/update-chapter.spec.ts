import { describe, expect, it } from "vitest";

import { updateChapterSchema } from "@/lib/schemas/chapter";

describe("updateChapterSchema — title (feature 026)", () => {
  it("aceita title válido", () => {
    const parsed = updateChapterSchema.parse({ title: "Abertura" });
    expect(parsed).toEqual({ title: "Abertura" });
  });

  it("aplica trim em title", () => {
    const parsed = updateChapterSchema.parse({ title: "  Abertura  " });
    expect(parsed.title).toBe("Abertura");
  });

  it("rejeita title vazio", () => {
    expect(() => updateChapterSchema.parse({ title: "" })).toThrow();
  });

  it("rejeita title só com espaços", () => {
    expect(() => updateChapterSchema.parse({ title: "   " })).toThrow();
  });

  it("rejeita title > 100 caracteres", () => {
    expect(() => updateChapterSchema.parse({ title: "a".repeat(101) })).toThrow();
  });

  it("rejeita title com \\n", () => {
    expect(() => updateChapterSchema.parse({ title: "a\nb" })).toThrow();
  });

  it("rejeita title com \\r", () => {
    expect(() => updateChapterSchema.parse({ title: "a\rb" })).toThrow();
  });

  it("title é opcional (não bloqueia update de outros campos)", () => {
    const parsed = updateChapterSchema.parse({ status: "pending" });
    expect(parsed).toEqual({ status: "pending" });
  });

  it("mensagem PT-BR para title inválido", () => {
    const result = updateChapterSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "";
      expect(message).toMatch(/[Tt]ítulo/);
    }
  });
});
