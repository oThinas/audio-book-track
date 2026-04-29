import { describe, expect, it } from "vitest";

import { bookIdParamsSchema, createBookSchema, updateBookSchema } from "@/lib/schemas/book";

function makeValidCreateInput() {
  return {
    title: "Dom Casmurro",
    studioId: crypto.randomUUID(),
    pricePerHourCents: 7500,
    numChapters: 10,
  };
}

describe("createBookSchema", () => {
  describe("title", () => {
    it("accepts a non-empty title", () => {
      const result = createBookSchema.safeParse(makeValidCreateInput());
      expect(result.success).toBe(true);
    });

    it("trims leading/trailing whitespace", () => {
      const result = createBookSchema.safeParse({
        ...makeValidCreateInput(),
        title: "   Dom Casmurro   ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Dom Casmurro");
      }
    });

    it("rejects empty title", () => {
      const result = createBookSchema.safeParse({ ...makeValidCreateInput(), title: "" });
      expect(result.success).toBe(false);
    });

    it("rejects whitespace-only title after trim", () => {
      const result = createBookSchema.safeParse({ ...makeValidCreateInput(), title: "   " });
      expect(result.success).toBe(false);
    });

    it("rejects title longer than 255 chars", () => {
      const result = createBookSchema.safeParse({
        ...makeValidCreateInput(),
        title: "a".repeat(256),
      });
      expect(result.success).toBe(false);
    });

    it("accepts title with exactly 255 chars", () => {
      const result = createBookSchema.safeParse({
        ...makeValidCreateInput(),
        title: "a".repeat(255),
      });
      expect(result.success).toBe(true);
    });

    it("is required", () => {
      const { title: _omit, ...rest } = makeValidCreateInput();
      const result = createBookSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe("studioId", () => {
    it("rejects non-UUID value", () => {
      const result = createBookSchema.safeParse({
        ...makeValidCreateInput(),
        studioId: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });

    it("is required", () => {
      const { studioId: _omit, ...rest } = makeValidCreateInput();
      const result = createBookSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe("pricePerHourCents", () => {
    it("accepts minimum value (1)", () => {
      const result = createBookSchema.safeParse({
        ...makeValidCreateInput(),
        pricePerHourCents: 1,
      });
      expect(result.success).toBe(true);
    });

    it("accepts maximum value (999_999)", () => {
      const result = createBookSchema.safeParse({
        ...makeValidCreateInput(),
        pricePerHourCents: 999_999,
      });
      expect(result.success).toBe(true);
    });

    it("rejects zero", () => {
      const result = createBookSchema.safeParse({
        ...makeValidCreateInput(),
        pricePerHourCents: 0,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative value", () => {
      const result = createBookSchema.safeParse({
        ...makeValidCreateInput(),
        pricePerHourCents: -1,
      });
      expect(result.success).toBe(false);
    });

    it("rejects value above 999_999", () => {
      const result = createBookSchema.safeParse({
        ...makeValidCreateInput(),
        pricePerHourCents: 1_000_000,
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-integer (float) values", () => {
      const result = createBookSchema.safeParse({
        ...makeValidCreateInput(),
        pricePerHourCents: 75.5,
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-numeric strings", () => {
      const result = createBookSchema.safeParse({
        ...makeValidCreateInput(),
        pricePerHourCents: "7500",
      });
      expect(result.success).toBe(false);
    });

    it("is required", () => {
      const { pricePerHourCents: _omit, ...rest } = makeValidCreateInput();
      const result = createBookSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe("numChapters", () => {
    it("accepts minimum value (1)", () => {
      const result = createBookSchema.safeParse({
        ...makeValidCreateInput(),
        numChapters: 1,
      });
      expect(result.success).toBe(true);
    });

    it("accepts maximum value (999)", () => {
      const result = createBookSchema.safeParse({
        ...makeValidCreateInput(),
        numChapters: 999,
      });
      expect(result.success).toBe(true);
    });

    it("rejects zero", () => {
      const result = createBookSchema.safeParse({
        ...makeValidCreateInput(),
        numChapters: 0,
      });
      expect(result.success).toBe(false);
    });

    it("rejects value above 999", () => {
      const result = createBookSchema.safeParse({
        ...makeValidCreateInput(),
        numChapters: 1000,
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-integer value", () => {
      const result = createBookSchema.safeParse({
        ...makeValidCreateInput(),
        numChapters: 10.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("inlineStudioId (optional)", () => {
    it("accepts when omitted", () => {
      const result = createBookSchema.safeParse(makeValidCreateInput());
      expect(result.success).toBe(true);
    });

    it("accepts when equal to studioId", () => {
      const input = makeValidCreateInput();
      const result = createBookSchema.safeParse({
        ...input,
        inlineStudioId: input.studioId,
      });
      expect(result.success).toBe(true);
    });

    it("rejects when different from studioId", () => {
      const result = createBookSchema.safeParse({
        ...makeValidCreateInput(),
        inlineStudioId: crypto.randomUUID(),
      });
      expect(result.success).toBe(false);
    });

    it("rejects when not a valid UUID", () => {
      const result = createBookSchema.safeParse({
        ...makeValidCreateInput(),
        inlineStudioId: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("updateBookSchema", () => {
  it("accepts partial update with only title", () => {
    const result = updateBookSchema.safeParse({ title: "New title" });
    expect(result.success).toBe(true);
  });

  it("accepts partial update with only pricePerHourCents", () => {
    const result = updateBookSchema.safeParse({ pricePerHourCents: 8500 });
    expect(result.success).toBe(true);
  });

  it("accepts partial update with only numChapters", () => {
    const result = updateBookSchema.safeParse({ numChapters: 12 });
    expect(result.success).toBe(true);
  });

  it("accepts partial update with only studioId", () => {
    const result = updateBookSchema.safeParse({ studioId: crypto.randomUUID() });
    expect(result.success).toBe(true);
  });

  it("rejects empty object (at least one field required)", () => {
    const result = updateBookSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("applies the same range checks as createBookSchema", () => {
    expect(updateBookSchema.safeParse({ pricePerHourCents: 0 }).success).toBe(false);
    expect(updateBookSchema.safeParse({ pricePerHourCents: 1_000_000 }).success).toBe(false);
    expect(updateBookSchema.safeParse({ numChapters: 0 }).success).toBe(false);
    expect(updateBookSchema.safeParse({ numChapters: 1000 }).success).toBe(false);
  });

  it("trims title on update", () => {
    const result = updateBookSchema.safeParse({ title: "   spaced   " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("spaced");
    }
  });

  it("rejects empty title after trim", () => {
    const result = updateBookSchema.safeParse({ title: "   " });
    expect(result.success).toBe(false);
  });
});

describe("bookIdParamsSchema", () => {
  it("accepts a valid UUID", () => {
    const result = bookIdParamsSchema.safeParse({ id: crypto.randomUUID() });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID id", () => {
    const result = bookIdParamsSchema.safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects missing id", () => {
    const result = bookIdParamsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
