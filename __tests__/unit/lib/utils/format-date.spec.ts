import { describe, expect, it } from "vitest";

import type { FocusWeekContext } from "@/lib/domain/chapter-deadline";
import { formatDeadline, formatRelativeDeadline } from "@/lib/utils/format-date";

const ctx: FocusWeekContext = {
  todayIso: "2026-05-14",
  mondayIso: "2026-05-11",
  sundayIso: "2026-05-17",
};

describe("formatDeadline", () => {
  it("formats ISO YYYY-MM-DD as DD/MM/YYYY (pt-BR)", () => {
    expect(formatDeadline("2026-06-15")).toBe("15/06/2026");
    expect(formatDeadline("2026-01-01")).toBe("01/01/2026");
    expect(formatDeadline("2026-12-31")).toBe("31/12/2026");
  });
});

describe("formatRelativeDeadline", () => {
  it('returns "hoje" when deadline is today', () => {
    expect(formatRelativeDeadline("2026-05-14", ctx)).toBe("hoje");
  });

  it('returns "amanhã" when deadline is today + 1', () => {
    expect(formatRelativeDeadline("2026-05-15", ctx)).toBe("amanhã");
  });

  it('returns "ontem" when deadline is today - 1 (no "atrasado" prefix)', () => {
    expect(formatRelativeDeadline("2026-05-13", ctx)).toBe("ontem");
  });

  it('returns "em N dias" for future deadlines beyond 1 day', () => {
    expect(formatRelativeDeadline("2026-05-17", ctx)).toBe("em 3 dias");
    expect(formatRelativeDeadline("2026-06-13", ctx)).toBe("em 30 dias");
  });

  it('returns "atrasado há N dias" for past deadlines beyond 1 day', () => {
    expect(formatRelativeDeadline("2026-05-09", ctx)).toBe("atrasado há 5 dias");
    expect(formatRelativeDeadline("2026-04-14", ctx)).toBe("atrasado há 30 dias");
  });
});
