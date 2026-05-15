import { describe, expect, it } from "vitest";

import { nextChapterTitle } from "@/lib/domain/next-chapter-title";

describe("nextChapterTitle", () => {
  it("retorna 'Capítulo 1' para lista vazia", () => {
    expect(nextChapterTitle([])).toBe("Capítulo 1");
  });

  it("retorna 'Capítulo {max+1}' em sequência contígua", () => {
    expect(nextChapterTitle(["Capítulo 1", "Capítulo 2", "Capítulo 3"])).toBe("Capítulo 4");
  });

  it("ignora títulos não-numerados", () => {
    expect(nextChapterTitle(["Prólogo", "Capítulo 1", "Epílogo"])).toBe("Capítulo 2");
  });

  it("retorna 'Capítulo 1' quando só há títulos não-numerados", () => {
    expect(nextChapterTitle(["Prólogo", "Apresentação", "Epílogo"])).toBe("Capítulo 1");
  });

  it("usa max+1 mesmo com gaps", () => {
    expect(nextChapterTitle(["Capítulo 1", "Capítulo 5"])).toBe("Capítulo 6");
  });

  it("rejeita 'Capitulo' sem acento", () => {
    expect(nextChapterTitle(["Capitulo 1", "Capitulo 2"])).toBe("Capítulo 1");
  });

  it("rejeita 'Capítulo  1' com dois espaços", () => {
    expect(nextChapterTitle(["Capítulo  1"])).toBe("Capítulo 1");
  });

  it("rejeita 'Capítulo 1 — Bonus'", () => {
    expect(nextChapterTitle(["Capítulo 1 — Bonus"])).toBe("Capítulo 1");
  });

  it("rejeita 'Capítulo 1.5'", () => {
    expect(nextChapterTitle(["Capítulo 1.5"])).toBe("Capítulo 1");
  });

  it("rejeita prefixo extra ' Capítulo 1'", () => {
    expect(nextChapterTitle([" Capítulo 1"])).toBe("Capítulo 1");
  });

  it("suporta números grandes", () => {
    expect(nextChapterTitle(["Capítulo 9999"])).toBe("Capítulo 10000");
  });

  it("aceita mistura de numerado e templates", () => {
    expect(nextChapterTitle(["Capítulo 2", "Prólogo", "Capítulo 1", "Apresentação"])).toBe(
      "Capítulo 3",
    );
  });
});
