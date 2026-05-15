import { describe, expect, it } from "vitest";

import { type ErrorCode, errorCodes } from "@/lib/api/error-codes";

const ALLOWED_STATUSES = new Set([0, 401, 404, 409, 422, 500]);
const ALLOWED_VARIANTS = new Set(["error", "warning"]);

const ENGLISH_TECHNICAL_TERMS = ["Error", "Required", "Invalid", "Unauthorized", "Found"];

const ANTI_LEAK_PATTERNS: ReadonlyArray<RegExp> = [
  /\$\{/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
];

describe("error-codes catalog", () => {
  it("every key is UPPER_SNAKE_CASE", () => {
    for (const code of Object.keys(errorCodes)) {
      expect(code, `code ${code} is not UPPER_SNAKE_CASE`).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it("every entry has a non-empty PT-BR message free of leak patterns and English domain terms", () => {
    for (const [code, entry] of Object.entries(errorCodes)) {
      expect(entry.message.length, `code ${code} has empty message`).toBeGreaterThan(0);
      for (const pattern of ANTI_LEAK_PATTERNS) {
        expect(entry.message, `code ${code} message leaks pattern ${pattern}`).not.toMatch(pattern);
      }
      for (const term of ENGLISH_TECHNICAL_TERMS) {
        const regex = new RegExp(`\\b${term}\\b`);
        expect(
          entry.message,
          `code ${code} message contains English technical term "${term}"`,
        ).not.toMatch(regex);
      }
    }
  });

  it("at least one PT-BR-distinctive marker appears across the catalog", () => {
    const allMessages = Object.values(errorCodes)
      .map((entry) => entry.message)
      .join(" ");
    expect(allMessages).toMatch(/[À-ÿ]/);
  });

  it("status is in the allowed set for this feature", () => {
    for (const [code, entry] of Object.entries(errorCodes)) {
      expect(
        ALLOWED_STATUSES.has(entry.status),
        `code ${code} has unexpected status ${entry.status}`,
      ).toBe(true);
    }
  });

  it("variant is undefined or one of error/warning", () => {
    for (const [code, entry] of Object.entries(errorCodes)) {
      if (entry.variant !== undefined) {
        expect(
          ALLOWED_VARIANTS.has(entry.variant),
          `code ${code} has invalid variant ${entry.variant}`,
        ).toBe(true);
      }
    }
  });

  it("catalog is exhaustive over the ErrorCode union (compile-time via Record<ErrorCode, …>)", () => {
    const sample: ErrorCode = "INTERNAL_ERROR";
    expect(errorCodes[sample]).toBeDefined();
  });

  it("NETWORK_ERROR is the only entry with status 0", () => {
    const zeros = Object.entries(errorCodes).filter(([, entry]) => entry.status === 0);
    expect(zeros).toHaveLength(1);
    expect(zeros[0][0]).toBe("NETWORK_ERROR");
  });

  describe("feature 026 — chapter titles, reordering, extras", () => {
    it("CHAPTER_TITLE_INVALID está presente com status 422", () => {
      expect(errorCodes.CHAPTER_TITLE_INVALID).toBeDefined();
      expect(errorCodes.CHAPTER_TITLE_INVALID.status).toBe(422);
      expect(errorCodes.CHAPTER_TITLE_INVALID.message).toMatch(/título/i);
    });

    it("CHAPTER_POSITION_TARGET_INVALID está presente com status 422", () => {
      expect(errorCodes.CHAPTER_POSITION_TARGET_INVALID).toBeDefined();
      expect(errorCodes.CHAPTER_POSITION_TARGET_INVALID.status).toBe(422);
      expect(errorCodes.CHAPTER_POSITION_TARGET_INVALID.message).toMatch(/posição/i);
    });

    it("CHAPTERS_ORDER_MISMATCH está presente com status 422", () => {
      expect(errorCodes.CHAPTERS_ORDER_MISMATCH).toBeDefined();
      expect(errorCodes.CHAPTERS_ORDER_MISMATCH.status).toBe(422);
    });

    it("BOOK_CHAPTERS_VERSION_CONFLICT está presente com status 409", () => {
      expect(errorCodes.BOOK_CHAPTERS_VERSION_CONFLICT).toBeDefined();
      expect(errorCodes.BOOK_CHAPTERS_VERSION_CONFLICT.status).toBe(409);
    });

    it("CHAPTER_NUMBER_ALREADY_IN_USE foi removido (não há mais número)", () => {
      expect((errorCodes as Record<string, unknown>).CHAPTER_NUMBER_ALREADY_IN_USE).toBeUndefined();
    });

    it("CHAPTER_PAID_LOCKED menciona título na mensagem (paid-lock estendido)", () => {
      expect(errorCodes.CHAPTER_PAID_LOCKED.message).toMatch(/título/i);
    });
  });
});
