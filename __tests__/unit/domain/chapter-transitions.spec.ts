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

const NON_PAID: ReadonlyArray<ChapterStatus> = ["pending", "editing", "reviewing", "retake"];

describe("validateChapterTransition (PT-BR reasons)", () => {
  describe("identity transitions (from === to)", () => {
    it("returns valid for every status when from === to", () => {
      for (const status of ALL_STATUSES) {
        expect(validateChapterTransition(status, status, EMPTY_CTX)).toEqual({ valid: true });
      }
    });
  });

  describe("free movement between non-paid statuses", () => {
    for (const from of NON_PAID) {
      for (const to of NON_PAID) {
        if (from === to) continue;
        it(`${from} → ${to} is valid with an empty context`, () => {
          expect(validateChapterTransition(from, to, EMPTY_CTX)).toEqual({ valid: true });
        });
      }
    }
  });

  describe("entering completed", () => {
    it.each(NON_PAID)("%s → completed is valid with full context", (from) => {
      expect(validateChapterTransition(from, "completed", FULL_CTX)).toEqual({ valid: true });
    });

    it("returns the reworded NARRATOR_REQUIRED reason when narrator is missing", () => {
      expect(validateChapterTransition("editing", "completed", EMPTY_CTX)).toEqual({
        valid: false,
        reason: "Atribua um narrador antes de concluir ou pagar o capítulo.",
      });
    });

    it("returns the reworded EDITOR_REQUIRED reason when only narrator is set", () => {
      expect(
        validateChapterTransition("editing", "completed", {
          ...EMPTY_CTX,
          narratorId: NARRATOR_ID,
        }),
      ).toEqual({
        valid: false,
        reason: "Atribua um editor antes de concluir ou pagar o capítulo.",
      });
    });

    it("returns the reworded EDITED_SECONDS_REQUIRED reason when only seconds are missing", () => {
      expect(
        validateChapterTransition("reviewing", "completed", { ...FULL_CTX, editedSeconds: 0 }),
      ).toEqual({
        valid: false,
        reason: "Registre a minutagem (tempo editado) antes de concluir ou pagar o capítulo.",
      });
    });
  });

  describe("entering paid", () => {
    it("completed → paid is valid with full context", () => {
      expect(validateChapterTransition("completed", "paid", FULL_CTX)).toEqual({ valid: true });
    });

    it.each(NON_PAID)("%s → paid is invalid (only reachable from completed)", (from) => {
      expect(validateChapterTransition(from, "paid", FULL_CTX)).toEqual({
        valid: false,
        reason: "Transição de status não permitida.",
      });
    });
  });

  describe("leaving paid", () => {
    it("paid → completed is valid when confirmReversion=true", () => {
      expect(
        validateChapterTransition("paid", "completed", { ...FULL_CTX, confirmReversion: true }),
      ).toEqual({ valid: true });
    });

    it("returns REVERSION_CONFIRMATION_REQUIRED reason when confirmReversion is missing", () => {
      expect(validateChapterTransition("paid", "completed", FULL_CTX)).toEqual({
        valid: false,
        reason: "Confirme a reversão antes de retornar um capítulo pago para concluído.",
      });
    });

    it.each(NON_PAID)("paid → %s is invalid (only completed is allowed)", (target) => {
      expect(validateChapterTransition("paid", target, FULL_CTX)).toEqual({
        valid: false,
        reason: "Transição de status não permitida.",
      });
    });
  });
});
