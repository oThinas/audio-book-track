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

describe("isValidTransition", () => {
  describe("idempotent transitions (from === to)", () => {
    for (const status of ALL_STATUSES) {
      it(`${status} → ${status} is valid (noop)`, () => {
        const result = isValidTransition(status, status, EMPTY_CTX);
        expect(result.valid).toBe(true);
      });
    }
  });

  describe("pending → *", () => {
    it("pending → editing is valid when narratorId is set", () => {
      const result = isValidTransition("pending", "editing", {
        ...EMPTY_CTX,
        narratorId: NARRATOR_ID,
      });
      expect(result).toEqual({ valid: true });
    });

    it("pending → editing rejects when narratorId is null (NARRATOR_REQUIRED)", () => {
      const result = isValidTransition("pending", "editing", EMPTY_CTX);
      expect(result).toEqual({ valid: false, reason: "NARRATOR_REQUIRED" });
    });

    for (const to of ["reviewing", "retake", "completed", "paid"] as const) {
      it(`pending → ${to} is invalid (INVALID_STATUS_TRANSITION)`, () => {
        const result = isValidTransition("pending", to, FULL_CTX);
        expect(result).toEqual({ valid: false, reason: "INVALID_STATUS_TRANSITION" });
      });
    }
  });

  describe("editing → *", () => {
    it("editing → reviewing is valid when editorId and editedSeconds > 0 are set", () => {
      const result = isValidTransition("editing", "reviewing", FULL_CTX);
      expect(result).toEqual({ valid: true });
    });

    it("editing → reviewing rejects when editorId is null (EDITOR_OR_SECONDS_REQUIRED)", () => {
      const result = isValidTransition("editing", "reviewing", {
        ...FULL_CTX,
        editorId: null,
      });
      expect(result).toEqual({ valid: false, reason: "EDITOR_OR_SECONDS_REQUIRED" });
    });

    it("editing → reviewing rejects when editedSeconds is 0 (EDITOR_OR_SECONDS_REQUIRED)", () => {
      const result = isValidTransition("editing", "reviewing", {
        ...FULL_CTX,
        editedSeconds: 0,
      });
      expect(result).toEqual({ valid: false, reason: "EDITOR_OR_SECONDS_REQUIRED" });
    });

    it("editing → reviewing rejects when editedSeconds is negative", () => {
      const result = isValidTransition("editing", "reviewing", {
        ...FULL_CTX,
        editedSeconds: -1,
      });
      expect(result).toEqual({ valid: false, reason: "EDITOR_OR_SECONDS_REQUIRED" });
    });

    it("editing → pending is valid (reversion)", () => {
      const result = isValidTransition("editing", "pending", EMPTY_CTX);
      expect(result).toEqual({ valid: true });
    });

    for (const to of ["retake", "completed", "paid"] as const) {
      it(`editing → ${to} is invalid (INVALID_STATUS_TRANSITION)`, () => {
        const result = isValidTransition("editing", to, FULL_CTX);
        expect(result).toEqual({ valid: false, reason: "INVALID_STATUS_TRANSITION" });
      });
    }
  });

  describe("reviewing → *", () => {
    it("reviewing → retake is valid", () => {
      const result = isValidTransition("reviewing", "retake", EMPTY_CTX);
      expect(result).toEqual({ valid: true });
    });

    it("reviewing → completed is valid", () => {
      const result = isValidTransition("reviewing", "completed", EMPTY_CTX);
      expect(result).toEqual({ valid: true });
    });

    it("reviewing → editing is valid (reversion)", () => {
      const result = isValidTransition("reviewing", "editing", EMPTY_CTX);
      expect(result).toEqual({ valid: true });
    });

    for (const to of ["pending", "paid"] as const) {
      it(`reviewing → ${to} is invalid (INVALID_STATUS_TRANSITION)`, () => {
        const result = isValidTransition("reviewing", to, FULL_CTX);
        expect(result).toEqual({ valid: false, reason: "INVALID_STATUS_TRANSITION" });
      });
    }
  });

  describe("retake → *", () => {
    it("retake → reviewing is valid", () => {
      const result = isValidTransition("retake", "reviewing", EMPTY_CTX);
      expect(result).toEqual({ valid: true });
    });

    it("retake → editing is valid (reversion)", () => {
      const result = isValidTransition("retake", "editing", EMPTY_CTX);
      expect(result).toEqual({ valid: true });
    });

    for (const to of ["pending", "completed", "paid"] as const) {
      it(`retake → ${to} is invalid (INVALID_STATUS_TRANSITION)`, () => {
        const result = isValidTransition("retake", to, FULL_CTX);
        expect(result).toEqual({ valid: false, reason: "INVALID_STATUS_TRANSITION" });
      });
    }
  });

  describe("completed → *", () => {
    it("completed → paid is valid", () => {
      const result = isValidTransition("completed", "paid", EMPTY_CTX);
      expect(result).toEqual({ valid: true });
    });

    it("completed → reviewing is valid (reversion without confirmation)", () => {
      const result = isValidTransition("completed", "reviewing", EMPTY_CTX);
      expect(result).toEqual({ valid: true });
    });

    for (const to of ["pending", "editing", "retake"] as const) {
      it(`completed → ${to} is invalid (INVALID_STATUS_TRANSITION)`, () => {
        const result = isValidTransition("completed", to, FULL_CTX);
        expect(result).toEqual({ valid: false, reason: "INVALID_STATUS_TRANSITION" });
      });
    }
  });

  describe("paid → * (reversion)", () => {
    it("paid → completed is valid when confirmReversion is true", () => {
      const result = isValidTransition("paid", "completed", {
        ...EMPTY_CTX,
        confirmReversion: true,
      });
      expect(result).toEqual({ valid: true });
    });

    it("paid → completed rejects when confirmReversion is omitted (REVERSION_CONFIRMATION_REQUIRED)", () => {
      const result = isValidTransition("paid", "completed", EMPTY_CTX);
      expect(result).toEqual({
        valid: false,
        reason: "REVERSION_CONFIRMATION_REQUIRED",
      });
    });

    it("paid → completed rejects when confirmReversion is false", () => {
      const result = isValidTransition("paid", "completed", {
        ...EMPTY_CTX,
        confirmReversion: false,
      });
      expect(result).toEqual({
        valid: false,
        reason: "REVERSION_CONFIRMATION_REQUIRED",
      });
    });

    for (const to of ["pending", "editing", "reviewing", "retake"] as const) {
      it(`paid → ${to} is invalid (INVALID_STATUS_TRANSITION)`, () => {
        const result = isValidTransition("paid", to, {
          ...FULL_CTX,
          confirmReversion: true,
        });
        expect(result).toEqual({ valid: false, reason: "INVALID_STATUS_TRANSITION" });
      });
    }

    it("throws on unknown source status (exhaustiveness guard)", () => {
      expect(() =>
        // biome-ignore lint/suspicious/noExplicitAny: testando o branch `never` que existe apenas como rede de segurança em runtime
        isValidTransition("unknown" as any, "pending", FULL_CTX),
      ).toThrow(/status inesperado/);
    });
  });
});
