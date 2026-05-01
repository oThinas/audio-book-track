import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { ChapterStatus } from "@/lib/domain/chapter";
import {
  type ChapterTransitionContext,
  validateChapterTransition,
} from "@/lib/domain/chapter-transitions";

const NARRATOR_ID = randomUUID();
const EDITOR_ID = randomUUID();

const EMPTY_CTX: ChapterTransitionContext = {
  narratorId: null,
  editorId: null,
  editedSeconds: 0,
};

const FULL_CTX: ChapterTransitionContext = {
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

describe("validateChapterTransition", () => {
  describe("identity transitions (from === to)", () => {
    it("returns valid for every status when from === to", () => {
      for (const status of ALL_STATUSES) {
        expect(validateChapterTransition(status, status, FULL_CTX)).toEqual({ valid: true });
      }
    });
  });

  describe("from pending", () => {
    it("pending → editing is valid when narrator is set", () => {
      expect(
        validateChapterTransition("pending", "editing", { ...EMPTY_CTX, narratorId: NARRATOR_ID }),
      ).toEqual({ valid: true });
    });

    it("pending → editing returns NARRATOR_REQUIRED PT-BR reason when narrator is null", () => {
      const result = validateChapterTransition("pending", "editing", EMPTY_CTX);
      expect(result).toEqual({
        valid: false,
        reason: "Atribua um narrador antes de iniciar a edição.",
      });
    });

    it.each([
      "reviewing",
      "retake",
      "completed",
      "paid",
    ] as ChapterStatus[])("pending → %s is invalid (skipping editing step)", (target) => {
      const result = validateChapterTransition("pending", target, FULL_CTX);
      expect(result).toEqual({ valid: false, reason: "Transição de status não permitida." });
    });
  });

  describe("from editing", () => {
    it("editing → pending is valid (rollback)", () => {
      expect(validateChapterTransition("editing", "pending", FULL_CTX)).toEqual({ valid: true });
    });

    it("editing → reviewing is valid when editor + edited_seconds are set", () => {
      expect(validateChapterTransition("editing", "reviewing", FULL_CTX)).toEqual({ valid: true });
    });

    it("editing → reviewing returns EDITOR_OR_SECONDS_REQUIRED PT-BR reason when editor is null", () => {
      const result = validateChapterTransition("editing", "reviewing", {
        ...FULL_CTX,
        editorId: null,
      });
      expect(result).toEqual({
        valid: false,
        reason: "Atribua um editor e registre as horas editadas antes de enviar para revisão.",
      });
    });

    it("editing → reviewing returns EDITOR_OR_SECONDS_REQUIRED PT-BR reason when edited_seconds is 0", () => {
      const result = validateChapterTransition("editing", "reviewing", {
        ...FULL_CTX,
        editedSeconds: 0,
      });
      expect(result).toEqual({
        valid: false,
        reason: "Atribua um editor e registre as horas editadas antes de enviar para revisão.",
      });
    });

    it.each([
      "retake",
      "completed",
      "paid",
    ] as ChapterStatus[])("editing → %s is invalid", (target) => {
      const result = validateChapterTransition("editing", target, FULL_CTX);
      expect(result).toEqual({ valid: false, reason: "Transição de status não permitida." });
    });
  });

  describe("from reviewing", () => {
    it.each([
      "editing",
      "retake",
      "completed",
    ] as ChapterStatus[])("reviewing → %s is valid", (target) => {
      expect(validateChapterTransition("reviewing", target, FULL_CTX)).toEqual({ valid: true });
    });

    it.each(["pending", "paid"] as ChapterStatus[])("reviewing → %s is invalid", (target) => {
      const result = validateChapterTransition("reviewing", target, FULL_CTX);
      expect(result).toEqual({ valid: false, reason: "Transição de status não permitida." });
    });
  });

  describe("from retake", () => {
    it.each(["editing", "reviewing"] as ChapterStatus[])("retake → %s is valid", (target) => {
      expect(validateChapterTransition("retake", target, FULL_CTX)).toEqual({ valid: true });
    });

    it.each([
      "pending",
      "completed",
      "paid",
    ] as ChapterStatus[])("retake → %s is invalid", (target) => {
      const result = validateChapterTransition("retake", target, FULL_CTX);
      expect(result).toEqual({ valid: false, reason: "Transição de status não permitida." });
    });
  });

  describe("from completed", () => {
    it.each(["paid", "reviewing"] as ChapterStatus[])("completed → %s is valid", (target) => {
      expect(validateChapterTransition("completed", target, FULL_CTX)).toEqual({ valid: true });
    });

    it.each([
      "pending",
      "editing",
      "retake",
    ] as ChapterStatus[])("completed → %s is invalid", (target) => {
      const result = validateChapterTransition("completed", target, FULL_CTX);
      expect(result).toEqual({ valid: false, reason: "Transição de status não permitida." });
    });
  });

  describe("from paid", () => {
    it("paid → completed is valid when confirmReversion=true", () => {
      expect(
        validateChapterTransition("paid", "completed", { ...FULL_CTX, confirmReversion: true }),
      ).toEqual({ valid: true });
    });

    it("paid → completed returns REVERSION_CONFIRMATION_REQUIRED PT-BR reason when confirmReversion is missing", () => {
      const result = validateChapterTransition("paid", "completed", FULL_CTX);
      expect(result).toEqual({
        valid: false,
        reason: "Confirme a reversão antes de retornar um capítulo pago para concluído.",
      });
    });

    it.each([
      "pending",
      "editing",
      "reviewing",
      "retake",
    ] as ChapterStatus[])("paid → %s is invalid (only completed is allowed)", (target) => {
      const result = validateChapterTransition("paid", target, FULL_CTX);
      expect(result).toEqual({ valid: false, reason: "Transição de status não permitida." });
    });
  });
});
