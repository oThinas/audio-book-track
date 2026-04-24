import { describe, expect, it } from "vitest";

import { bulkDeleteChaptersSchema, updateChapterSchema } from "@/lib/schemas/chapter";

describe("updateChapterSchema", () => {
  describe("at least one field constraint", () => {
    it("rejects empty object", () => {
      const result = updateChapterSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("accepts a single status field", () => {
      const result = updateChapterSchema.safeParse({ status: "editing" });
      expect(result.success).toBe(true);
    });

    it("accepts a single narratorId field", () => {
      const result = updateChapterSchema.safeParse({ narratorId: crypto.randomUUID() });
      expect(result.success).toBe(true);
    });

    it("accepts a single editorId field", () => {
      const result = updateChapterSchema.safeParse({ editorId: crypto.randomUUID() });
      expect(result.success).toBe(true);
    });

    it("accepts a single editedSeconds field", () => {
      const result = updateChapterSchema.safeParse({ editedSeconds: 3600 });
      expect(result.success).toBe(true);
    });
  });

  describe("status", () => {
    const valid = ["pending", "editing", "reviewing", "retake", "completed", "paid"] as const;
    for (const s of valid) {
      it(`accepts valid status '${s}'`, () => {
        const result = updateChapterSchema.safeParse({ status: s });
        expect(result.success).toBe(true);
      });
    }

    it("rejects unknown status value", () => {
      const result = updateChapterSchema.safeParse({ status: "archived" });
      expect(result.success).toBe(false);
    });
  });

  describe("narratorId", () => {
    it("accepts a valid UUID", () => {
      const result = updateChapterSchema.safeParse({ narratorId: crypto.randomUUID() });
      expect(result.success).toBe(true);
    });

    it("accepts explicit null (unassign)", () => {
      const result = updateChapterSchema.safeParse({ narratorId: null });
      expect(result.success).toBe(true);
    });

    it("rejects non-UUID string", () => {
      const result = updateChapterSchema.safeParse({ narratorId: "not-a-uuid" });
      expect(result.success).toBe(false);
    });
  });

  describe("editorId", () => {
    it("accepts a valid UUID", () => {
      const result = updateChapterSchema.safeParse({ editorId: crypto.randomUUID() });
      expect(result.success).toBe(true);
    });

    it("accepts explicit null (unassign)", () => {
      const result = updateChapterSchema.safeParse({ editorId: null });
      expect(result.success).toBe(true);
    });

    it("rejects non-UUID string", () => {
      const result = updateChapterSchema.safeParse({ editorId: "not-a-uuid" });
      expect(result.success).toBe(false);
    });
  });

  describe("editedSeconds", () => {
    it("accepts minimum value (0)", () => {
      const result = updateChapterSchema.safeParse({ editedSeconds: 0 });
      expect(result.success).toBe(true);
    });

    it("accepts maximum value (3_600_000)", () => {
      const result = updateChapterSchema.safeParse({ editedSeconds: 3_600_000 });
      expect(result.success).toBe(true);
    });

    it("rejects negative value", () => {
      const result = updateChapterSchema.safeParse({ editedSeconds: -1 });
      expect(result.success).toBe(false);
    });

    it("rejects value above 3_600_000", () => {
      const result = updateChapterSchema.safeParse({ editedSeconds: 3_600_001 });
      expect(result.success).toBe(false);
    });

    it("rejects floats (must be integer seconds)", () => {
      const result = updateChapterSchema.safeParse({ editedSeconds: 3600.5 });
      expect(result.success).toBe(false);
    });

    it("rejects numeric strings", () => {
      const result = updateChapterSchema.safeParse({ editedSeconds: "3600" });
      expect(result.success).toBe(false);
    });
  });

  describe("confirmReversion", () => {
    it("accepts true", () => {
      const result = updateChapterSchema.safeParse({
        status: "completed",
        confirmReversion: true,
      });
      expect(result.success).toBe(true);
    });

    it("accepts false", () => {
      const result = updateChapterSchema.safeParse({
        status: "completed",
        confirmReversion: false,
      });
      expect(result.success).toBe(true);
    });

    it("rejects non-boolean", () => {
      const result = updateChapterSchema.safeParse({
        status: "completed",
        confirmReversion: "yes",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("combined valid payloads", () => {
    it("accepts status + narratorId", () => {
      const result = updateChapterSchema.safeParse({
        status: "editing",
        narratorId: crypto.randomUUID(),
      });
      expect(result.success).toBe(true);
    });

    it("accepts editorId + editedSeconds", () => {
      const result = updateChapterSchema.safeParse({
        editorId: crypto.randomUUID(),
        editedSeconds: 9000,
      });
      expect(result.success).toBe(true);
    });

    it("accepts reversion payload (status=completed + confirmReversion=true)", () => {
      const result = updateChapterSchema.safeParse({
        status: "completed",
        confirmReversion: true,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("bulkDeleteChaptersSchema", () => {
  it("accepts a single valid UUID", () => {
    const result = bulkDeleteChaptersSchema.safeParse({ chapterIds: [crypto.randomUUID()] });
    expect(result.success).toBe(true);
  });

  it("accepts multiple valid UUIDs", () => {
    const result = bulkDeleteChaptersSchema.safeParse({
      chapterIds: [crypto.randomUUID(), crypto.randomUUID()],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty list", () => {
    const result = bulkDeleteChaptersSchema.safeParse({ chapterIds: [] });
    expect(result.success).toBe(false);
  });

  it("rejects list with any non-UUID item", () => {
    const result = bulkDeleteChaptersSchema.safeParse({
      chapterIds: [crypto.randomUUID(), "not-a-uuid"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects list above 999 items", () => {
    const ids = Array.from({ length: 1000 }, () => crypto.randomUUID());
    const result = bulkDeleteChaptersSchema.safeParse({ chapterIds: ids });
    expect(result.success).toBe(false);
  });

  it("rejects missing chapterIds field", () => {
    const result = bulkDeleteChaptersSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
