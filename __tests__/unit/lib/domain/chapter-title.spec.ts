import { describe, expect, it } from "vitest";

import {
  CHAPTER_TITLE_MAX,
  normalizeChapterTitle,
  validateChapterTitle,
} from "@/lib/domain/chapter-title";

describe("normalizeChapterTitle", () => {
  it("aplica trim em espaços externos", () => {
    expect(normalizeChapterTitle("  Prólogo  ")).toBe("Prólogo");
  });

  it("preserva espaços internos", () => {
    expect(normalizeChapterTitle(" Capítulo  Final ")).toBe("Capítulo  Final");
  });

  it("retorna string vazia quando entrada é só espaço", () => {
    expect(normalizeChapterTitle("    ")).toBe("");
  });
});

describe("validateChapterTitle", () => {
  it("rejeita string vazia", () => {
    expect(validateChapterTitle("")).toEqual({ ok: false, reason: "empty" });
  });

  it("rejeita string só com espaços (empty após trim)", () => {
    expect(validateChapterTitle("   ")).toEqual({ ok: false, reason: "empty" });
  });

  it(`rejeita título com mais de ${CHAPTER_TITLE_MAX} caracteres`, () => {
    const tooLong = "a".repeat(CHAPTER_TITLE_MAX + 1);
    expect(validateChapterTitle(tooLong)).toEqual({ ok: false, reason: "too_long" });
  });

  it(`aceita título no limite (${CHAPTER_TITLE_MAX} caracteres)`, () => {
    const atLimit = "a".repeat(CHAPTER_TITLE_MAX);
    expect(validateChapterTitle(atLimit)).toEqual({ ok: true, value: atLimit });
  });

  it("rejeita título com \\n", () => {
    expect(validateChapterTitle("linha1\nlinha2")).toEqual({ ok: false, reason: "has_newline" });
  });

  it("rejeita título com \\r", () => {
    expect(validateChapterTitle("linha1\rlinha2")).toEqual({ ok: false, reason: "has_newline" });
  });

  it("aceita título válido", () => {
    expect(validateChapterTitle("Prólogo")).toEqual({ ok: true, value: "Prólogo" });
  });

  it("aplica trim antes de validar e retorna trimmed", () => {
    expect(validateChapterTitle("  Abertura  ")).toEqual({ ok: true, value: "Abertura" });
  });

  it("aceita Unicode emoji", () => {
    expect(validateChapterTitle("😎 Capítulo 1")).toEqual({ ok: true, value: "😎 Capítulo 1" });
  });

  it("aceita acentos e caracteres especiais", () => {
    expect(validateChapterTitle("Bonjour — Première étape")).toEqual({
      ok: true,
      value: "Bonjour — Première étape",
    });
  });
});
