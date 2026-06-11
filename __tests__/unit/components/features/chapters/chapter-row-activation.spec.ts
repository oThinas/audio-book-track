import { describe, expect, it } from "vitest";

import {
  type ChapterEditField,
  type ChapterRowActivation,
  resolveActivation,
} from "@/components/features/chapters/chapter-row-activation";

const ALL_FALSE: ChapterRowActivation = {
  titleAutoFocus: false,
  statusOpen: false,
  narratorOpen: false,
  editorOpen: false,
  deadlineOpen: false,
  editedSecondsAutoFocus: false,
};

const nonPaid = { status: "editing" } as const;
const paid = { status: "paid" } as const;

const FLAG_BY_FIELD: Record<ChapterEditField, keyof ChapterRowActivation> = {
  title: "titleAutoFocus",
  status: "statusOpen",
  narrator: "narratorOpen",
  editor: "editorOpen",
  deadline: "deadlineOpen",
  editedSeconds: "editedSecondsAutoFocus",
};

const ALL_FIELDS = Object.keys(FLAG_BY_FIELD) as ChapterEditField[];

describe("resolveActivation", () => {
  it("activates nothing when field is null (pencil entry)", () => {
    expect(resolveActivation(null, nonPaid)).toEqual(ALL_FALSE);
    expect(resolveActivation(null, paid)).toEqual(ALL_FALSE);
  });

  it("activates exactly the targeted field's flag on a non-paid chapter", () => {
    for (const field of ALL_FIELDS) {
      const result = resolveActivation(field, nonPaid);
      const expectedFlag = FLAG_BY_FIELD[field];
      expect(result[expectedFlag], `${field} should set ${expectedFlag}`).toBe(true);
      for (const flag of Object.values(FLAG_BY_FIELD)) {
        if (flag !== expectedFlag) {
          expect(result[flag], `${field} must leave ${flag} false`).toBe(false);
        }
      }
    }
  });

  it("skips activation for every PAID_LOCKED_FIELDS field on a paid chapter", () => {
    // narratorId, editorId, editedSeconds, deadline, title are all locked.
    for (const field of ["title", "narrator", "editor", "deadline", "editedSeconds"] as const) {
      expect(resolveActivation(field, paid), `${field} must skip activation on paid`).toEqual(
        ALL_FALSE,
      );
    }
  });

  it("still opens the status dropdown on a paid chapter (reversion is allowed)", () => {
    expect(resolveActivation("status", paid)).toEqual({ ...ALL_FALSE, statusOpen: true });
  });
});
