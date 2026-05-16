import { describe, expect, it } from "vitest";

import { chapterTitleSchema } from "@/lib/schemas/chapter";

describe("chapterTitleSchema (base helper)", () => {
  it("aceita título válido e aplica trim", () => {
    expect(chapterTitleSchema.parse("  Prólogo  ")).toBe("Prólogo");
  });

  it("rejeita string vazia", () => {
    expect(() => chapterTitleSchema.parse("")).toThrow();
  });

  it("rejeita string só com espaços (vira vazio após trim)", () => {
    expect(() => chapterTitleSchema.parse("   ")).toThrow();
  });

  it("rejeita título com mais de 100 caracteres", () => {
    expect(() => chapterTitleSchema.parse("a".repeat(101))).toThrow();
  });

  it("aceita exatamente 100 caracteres", () => {
    const atLimit = "a".repeat(100);
    expect(chapterTitleSchema.parse(atLimit)).toBe(atLimit);
  });

  it("rejeita título com \\n", () => {
    expect(() => chapterTitleSchema.parse("linha1\nlinha2")).toThrow();
  });

  it("rejeita título com \\r", () => {
    expect(() => chapterTitleSchema.parse("linha1\rlinha2")).toThrow();
  });

  it("retorna mensagem PT-BR quando inválido", () => {
    const result = chapterTitleSchema.safeParse("");
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "";
      expect(message).toMatch(/[Tt]ítulo/);
    }
  });
});
