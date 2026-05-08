import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { createEditorSchema, editorFormSchema, updateEditorSchema } from "@/lib/domain/editor";
import {
  createNarratorSchema,
  narratorFormSchema,
  updateNarratorSchema,
} from "@/lib/domain/narrator";
import {
  createStudioRequestSchema,
  createStudioSchema,
  studioFormSchema,
  updateStudioSchema,
} from "@/lib/domain/studio";
import { updateUserPreferenceSchema } from "@/lib/domain/user-preference";
import { loginSchema } from "@/lib/schemas/auth";
import { bookIdParamsSchema, createBookSchema, updateBookSchema } from "@/lib/schemas/book";
import {
  bulkDeleteChaptersSchema,
  chapterIdParamsSchema,
  updateChapterSchema,
} from "@/lib/schemas/chapter";

// English domain words and Zod-default phrases that must NEVER surface in
// validation messages. Field IDs (studioId, narratorId, editorId, etc.) are
// also banned because users see them and they are jargon.
const ENGLISH_LEAK_PATTERNS = [
  /\bRequired\b/,
  /\bInvalid input\b/,
  /\bExpected\b/,
  /\bmust be\b/i,
  /\bmust contain\b/i,
  /\bmust have\b/i,
  /\bmust match\b/i,
  /\bat least\b/i,
  /\bat most\b/i,
  /\btoo small\b/i,
  /\btoo big\b/i,
  /\btoo large\b/i,
  /\bmin\b\s*\d/i,
  /\bmax\b\s*\d/i,
  // Field-ID jargon leaking into user-facing copy.
  /\bstudioId\b/,
  /\bnarratorId\b/,
  /\beditorId\b/,
  /\bchapterId\b/,
  /\binlineStudioId\b/,
  /\beditedSeconds\b/,
] as const;

function assertPtBrMessage(message: string): void {
  for (const pattern of ENGLISH_LEAK_PATTERNS) {
    expect(message, `Validation message leaked English/jargon: "${message}"`).not.toMatch(pattern);
  }
}

interface SchemaCase {
  readonly name: string;
  readonly schema: z.ZodType;
  readonly invalidPayloads: ReadonlyArray<unknown>;
}

const schemaCases: ReadonlyArray<SchemaCase> = [
  // Book
  {
    name: "createBookSchema",
    schema: createBookSchema,
    invalidPayloads: [
      {},
      { title: "", studioId: "x", pricePerHourCents: 0, numChapters: 0 },
      {
        title: "x".repeat(300),
        studioId: "not-uuid",
        pricePerHourCents: 0,
        numChapters: 0,
      },
      {
        title: "Ok",
        studioId: crypto.randomUUID(),
        pricePerHourCents: 7500,
        numChapters: 1,
        inlineStudioId: crypto.randomUUID(),
      },
    ],
  },
  {
    name: "updateBookSchema",
    schema: updateBookSchema,
    invalidPayloads: [
      {},
      { title: "" },
      { studioId: "not-uuid" },
      { numChapters: 0 },
      { pricePerHourCents: -1 },
      { pdfUrl: "ftp://bad" },
      { pdfUrl: "javascript:alert(1)" },
    ],
  },
  {
    name: "bookIdParamsSchema",
    schema: bookIdParamsSchema,
    invalidPayloads: [{}, { id: "not-uuid" }],
  },

  // Chapter
  {
    name: "updateChapterSchema",
    schema: updateChapterSchema,
    invalidPayloads: [
      {},
      { narratorId: "not-uuid" },
      { editorId: "not-uuid" },
      { editedSeconds: -1 },
      { editedSeconds: 99_999_999 },
    ],
  },
  {
    name: "bulkDeleteChaptersSchema",
    schema: bulkDeleteChaptersSchema,
    invalidPayloads: [{}, { chapterIds: [] }, { chapterIds: ["not-uuid"] }],
  },
  {
    name: "chapterIdParamsSchema",
    schema: chapterIdParamsSchema,
    invalidPayloads: [{}, { id: "not-uuid" }],
  },

  // Studio
  {
    name: "createStudioSchema",
    schema: createStudioSchema,
    invalidPayloads: [
      {},
      { name: "x", defaultHourlyRateCents: 0 },
      { name: "x".repeat(200), defaultHourlyRateCents: -1 },
    ],
  },
  {
    name: "updateStudioSchema",
    schema: updateStudioSchema,
    invalidPayloads: [{ name: "x" }, { defaultHourlyRateCents: 0 }],
  },
  {
    name: "createStudioRequestSchema",
    schema: createStudioRequestSchema,
    invalidPayloads: [{}, { name: "x", defaultHourlyRateCents: 0 }],
  },
  {
    name: "studioFormSchema",
    schema: studioFormSchema,
    invalidPayloads: [{ name: "x", defaultHourlyRateCents: 0 }],
  },

  // Narrator
  {
    name: "createNarratorSchema",
    schema: createNarratorSchema,
    invalidPayloads: [{}, { name: "x" }, { name: "x".repeat(200) }],
  },
  {
    name: "updateNarratorSchema",
    schema: updateNarratorSchema,
    invalidPayloads: [{ name: "x" }],
  },
  {
    name: "narratorFormSchema",
    schema: narratorFormSchema,
    invalidPayloads: [{}, { name: "x" }],
  },

  // Editor
  {
    name: "createEditorSchema",
    schema: createEditorSchema,
    invalidPayloads: [{}, { name: "x", email: "not-email" }, { name: "x".repeat(200), email: "" }],
  },
  {
    name: "updateEditorSchema",
    schema: updateEditorSchema,
    invalidPayloads: [{ email: "not-email" }, { name: "x" }],
  },
  {
    name: "editorFormSchema",
    schema: editorFormSchema,
    invalidPayloads: [{}, { name: "x", email: "not-email" }],
  },

  // User preferences
  {
    name: "updateUserPreferenceSchema",
    schema: updateUserPreferenceSchema,
    invalidPayloads: [{}, { theme: "neon" }, { fontSize: "huge" }],
  },

  // Auth
  {
    name: "loginSchema",
    schema: loginSchema,
    invalidPayloads: [
      {},
      { username: "", password: "" },
      { username: "ab", password: "12345" },
      { username: "user!@#", password: "secret" },
    ],
  },
];

describe("Schemas — all validation messages are PT-BR with no English/jargon leak", () => {
  for (const { name, schema, invalidPayloads } of schemaCases) {
    describe(name, () => {
      for (const payload of invalidPayloads) {
        it(`payload ${JSON.stringify(payload).slice(0, 80)} → all issue messages PT-BR`, () => {
          const result = schema.safeParse(payload);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.length).toBeGreaterThan(0);
            for (const issue of result.error.issues) {
              assertPtBrMessage(issue.message);
            }
          }
        });
      }
    });
  }
});
