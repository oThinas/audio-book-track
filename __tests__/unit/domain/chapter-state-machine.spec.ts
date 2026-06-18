import { describe, expect, it } from "vitest";

import type { ChapterStatus } from "@/lib/domain/chapter";
import { isValidTransition, type TransitionContext } from "@/lib/domain/chapter-state-machine";

const NARRATOR_ID = "11111111-1111-1111-1111-111111111111";
const EDITOR_ID = "22222222-2222-2222-2222-222222222222";

const EMPTY_CTX: TransitionContext = {
  narratorId: null,
  editorId: null,
  editedSeconds: 0,
};

const FULL_CTX: TransitionContext = {
  narratorId: NARRATOR_ID,
  editorId: EDITOR_ID,
  editedSeconds: 3600,
};

const ALL_STATUSES: ReadonlyArray<ChapterStatus> = [
  "pending",
  "editing",
  "reviewing",
  "retake",
  "completed",
  "paid",
];

const NON_PAID: ReadonlyArray<ChapterStatus> = ["pending", "editing", "reviewing", "retake"];

describe("isValidTransition (flexible non-paid graph, guarded paid edges)", () => {
  describe("idempotent transitions (from === to)", () => {
    for (const status of ALL_STATUSES) {
      it(`${status} → ${status} is valid (noop), even with an empty context`, () => {
        expect(isValidTransition(status, status, EMPTY_CTX)).toEqual({ valid: true });
      });
    }
  });

  describe("free movement between non-paid statuses (no field requirements)", () => {
    for (const from of NON_PAID) {
      for (const to of NON_PAID) {
        if (from === to) continue;
        it(`${from} → ${to} is valid with an empty context`, () => {
          expect(isValidTransition(from, to, EMPTY_CTX)).toEqual({ valid: true });
        });
      }
    }

    it("completed → pending/editing/reviewing/retake is valid (free, no fields)", () => {
      for (const to of NON_PAID) {
        expect(isValidTransition("completed", to, EMPTY_CTX)).toEqual({ valid: true });
      }
    });
  });

  describe("entering completed requires narrator + editor + editedSeconds > 0", () => {
    const SOURCES: ReadonlyArray<ChapterStatus> = ["pending", "editing", "reviewing", "retake"];

    for (const from of SOURCES) {
      it(`${from} → completed is valid with full context`, () => {
        expect(isValidTransition(from, "completed", FULL_CTX)).toEqual({ valid: true });
      });

      it(`${from} → completed rejects NARRATOR_REQUIRED first when all fields are missing`, () => {
        expect(isValidTransition(from, "completed", EMPTY_CTX)).toEqual({
          valid: false,
          reason: "NARRATOR_REQUIRED",
        });
      });

      it(`${from} → completed rejects EDITOR_REQUIRED when only narrator is set`, () => {
        expect(
          isValidTransition(from, "completed", { ...EMPTY_CTX, narratorId: NARRATOR_ID }),
        ).toEqual({ valid: false, reason: "EDITOR_REQUIRED" });
      });

      it(`${from} → completed rejects EDITED_SECONDS_REQUIRED when only seconds are missing`, () => {
        expect(isValidTransition(from, "completed", { ...FULL_CTX, editedSeconds: 0 })).toEqual({
          valid: false,
          reason: "EDITED_SECONDS_REQUIRED",
        });
      });

      it(`${from} → completed rejects EDITED_SECONDS_REQUIRED when seconds are negative`, () => {
        expect(isValidTransition(from, "completed", { ...FULL_CTX, editedSeconds: -1 })).toEqual({
          valid: false,
          reason: "EDITED_SECONDS_REQUIRED",
        });
      });
    }
  });

  describe("entering paid is restricted to completed and requires the same fields", () => {
    it("completed → paid is valid with full context", () => {
      expect(isValidTransition("completed", "paid", FULL_CTX)).toEqual({ valid: true });
    });

    it("completed → paid rejects NARRATOR_REQUIRED first when all fields are missing", () => {
      expect(isValidTransition("completed", "paid", EMPTY_CTX)).toEqual({
        valid: false,
        reason: "NARRATOR_REQUIRED",
      });
    });

    it("completed → paid rejects EDITOR_REQUIRED when only narrator is set", () => {
      expect(
        isValidTransition("completed", "paid", { ...EMPTY_CTX, narratorId: NARRATOR_ID }),
      ).toEqual({ valid: false, reason: "EDITOR_REQUIRED" });
    });

    it("completed → paid rejects EDITED_SECONDS_REQUIRED when only seconds are missing", () => {
      expect(isValidTransition("completed", "paid", { ...FULL_CTX, editedSeconds: 0 })).toEqual({
        valid: false,
        reason: "EDITED_SECONDS_REQUIRED",
      });
    });

    for (const from of NON_PAID) {
      it(`${from} → paid is invalid (paid only reachable from completed)`, () => {
        expect(isValidTransition(from, "paid", FULL_CTX)).toEqual({
          valid: false,
          reason: "INVALID_STATUS_TRANSITION",
        });
      });
    }
  });

  describe("leaving paid is restricted to completed and requires reversion confirmation", () => {
    it("paid → completed is valid when confirmReversion is true", () => {
      expect(
        isValidTransition("paid", "completed", { ...EMPTY_CTX, confirmReversion: true }),
      ).toEqual({ valid: true });
    });

    it("paid → completed does not re-check narrator/editor/seconds (only confirmation)", () => {
      expect(
        isValidTransition("paid", "completed", { ...EMPTY_CTX, confirmReversion: true }),
      ).toEqual({ valid: true });
    });

    it("paid → completed rejects REVERSION_CONFIRMATION_REQUIRED when the flag is omitted", () => {
      expect(isValidTransition("paid", "completed", FULL_CTX)).toEqual({
        valid: false,
        reason: "REVERSION_CONFIRMATION_REQUIRED",
      });
    });

    it("paid → completed rejects REVERSION_CONFIRMATION_REQUIRED when the flag is false", () => {
      expect(
        isValidTransition("paid", "completed", { ...FULL_CTX, confirmReversion: false }),
      ).toEqual({ valid: false, reason: "REVERSION_CONFIRMATION_REQUIRED" });
    });

    for (const to of NON_PAID) {
      it(`paid → ${to} is invalid (only completed is reachable from paid)`, () => {
        expect(isValidTransition("paid", to, { ...FULL_CTX, confirmReversion: true })).toEqual({
          valid: false,
          reason: "INVALID_STATUS_TRANSITION",
        });
      });
    }
  });
});
