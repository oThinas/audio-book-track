import { describe, expect, it } from "vitest";

import { createChapterSchema } from "@/lib/schemas/chapter";

const UUID = "00000000-0000-4000-8000-000000000001";

describe("createChapterSchema", () => {
  it("aceita position='start' com title e expectedVersion", () => {
    const parsed = createChapterSchema.parse({
      title: "Prólogo",
      position: "start",
      expectedVersion: 0,
    });
    expect(parsed).toEqual({ title: "Prólogo", position: "start", expectedVersion: 0 });
  });

  it("aceita position='end'", () => {
    const parsed = createChapterSchema.parse({
      title: "Epílogo",
      position: "end",
      expectedVersion: 5,
    });
    expect(parsed.position).toBe("end");
  });

  it("aceita position={after: uuid}", () => {
    const parsed = createChapterSchema.parse({
      title: "Cap intermediário",
      position: { after: UUID },
      expectedVersion: 0,
    });
    expect(parsed.position).toEqual({ after: UUID });
  });

  it("rejeita title vazio", () => {
    expect(() =>
      createChapterSchema.parse({ title: "", position: "end", expectedVersion: 0 }),
    ).toThrow();
  });

  it("rejeita title com \\n", () => {
    expect(() =>
      createChapterSchema.parse({ title: "linha\nquebrada", position: "end", expectedVersion: 0 }),
    ).toThrow();
  });

  it("rejeita position={after: 'not-uuid'}", () => {
    expect(() =>
      createChapterSchema.parse({
        title: "x",
        position: { after: "not-uuid" },
        expectedVersion: 0,
      }),
    ).toThrow();
  });

  it("rejeita expectedVersion negativo", () => {
    expect(() =>
      createChapterSchema.parse({ title: "x", position: "end", expectedVersion: -1 }),
    ).toThrow();
  });

  it("rejeita position desconhecido", () => {
    expect(() =>
      createChapterSchema.parse({ title: "x", position: "middle", expectedVersion: 0 }),
    ).toThrow();
  });
});
