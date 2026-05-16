import { describe, expect, it } from "vitest";

import { createBookSchema } from "@/lib/schemas/book";

const STUDIO_ID = "00000000-0000-4000-8000-000000000001";

describe("createBookSchema — chapters input (feature 026)", () => {
  it("aceita numbered > 0 sem extras", () => {
    const parsed = createBookSchema.parse({
      title: "Livro",
      studioId: STUDIO_ID,
      pricePerHourCents: 7500,
      chapters: { numbered: 5, extras: [] },
    });
    expect(parsed.chapters.numbered).toBe(5);
    expect(parsed.chapters.extras).toEqual([]);
  });

  it("aceita numbered=0 com extras (template)", () => {
    const parsed = createBookSchema.parse({
      title: "Livro",
      studioId: STUDIO_ID,
      pricePerHourCents: 7500,
      chapters: {
        numbered: 0,
        extras: [{ kind: "template", template: "prologue", position: "start" }],
      },
    });
    expect(parsed.chapters.extras).toHaveLength(1);
  });

  it("aceita extras custom com title", () => {
    const parsed = createBookSchema.parse({
      title: "Livro",
      studioId: STUDIO_ID,
      pricePerHourCents: 7500,
      chapters: {
        numbered: 3,
        extras: [{ kind: "custom", title: "Apresentação", position: "end" }],
      },
    });
    expect(parsed.chapters.extras[0]).toMatchObject({ kind: "custom", title: "Apresentação" });
  });

  it("rejeita numbered=0 e extras vazias", () => {
    expect(() =>
      createBookSchema.parse({
        title: "Livro",
        studioId: STUDIO_ID,
        pricePerHourCents: 7500,
        chapters: { numbered: 0, extras: [] },
      }),
    ).toThrow();
  });

  it("rejeita template fora do catálogo", () => {
    expect(() =>
      createBookSchema.parse({
        title: "Livro",
        studioId: STUDIO_ID,
        pricePerHourCents: 7500,
        chapters: {
          numbered: 0,
          extras: [{ kind: "template", template: "preface", position: "start" }],
        },
      }),
    ).toThrow();
  });

  it("rejeita extras > 20", () => {
    const extras = Array.from({ length: 21 }, () => ({
      kind: "custom" as const,
      title: "x",
      position: "end" as const,
    }));
    expect(() =>
      createBookSchema.parse({
        title: "Livro",
        studioId: STUDIO_ID,
        pricePerHourCents: 7500,
        chapters: { numbered: 0, extras },
      }),
    ).toThrow();
  });

  it("rejeita campo legado numChapters", () => {
    expect(() =>
      createBookSchema.parse({
        title: "Livro",
        studioId: STUDIO_ID,
        pricePerHourCents: 7500,
        numChapters: 3,
      }),
    ).toThrow();
  });
});
