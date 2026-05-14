import { describe, expect, it } from "vitest";

import {
  APP_TIMEZONE,
  currentWeekRangeInAppTimezone,
  todayInAppTimezone,
} from "@/lib/domain/timezone";

const fixed = (iso: string) => () => new Date(iso);

describe("APP_TIMEZONE", () => {
  it('is the constant "America/Sao_Paulo"', () => {
    expect(APP_TIMEZONE).toBe("America/Sao_Paulo");
  });
});

describe("todayInAppTimezone", () => {
  it("returns YYYY-MM-DD in America/Sao_Paulo for noon UTC", () => {
    expect(todayInAppTimezone(fixed("2026-05-14T15:00:00.000Z"))).toBe("2026-05-14");
  });

  it("returns the previous day when UTC has rolled over but SP has not (early UTC morning)", () => {
    // 2026-05-14T02:00:00Z = 2026-05-13T23:00:00-03:00 (SP)
    expect(todayInAppTimezone(fixed("2026-05-14T02:00:00.000Z"))).toBe("2026-05-13");
  });

  it("returns the same day when UTC and SP are on the same calendar date (SP morning)", () => {
    // 2026-05-14T12:00:00Z = 2026-05-14T09:00:00-03:00 (SP)
    expect(todayInAppTimezone(fixed("2026-05-14T12:00:00.000Z"))).toBe("2026-05-14");
  });

  it("uses the system clock when no now function is provided", () => {
    const value = todayInAppTimezone();
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("currentWeekRangeInAppTimezone", () => {
  it("for a Wednesday, returns the correct Mon-Sun range (weekStartsOn=1)", () => {
    // 2026-05-13 is a Wednesday
    const range = currentWeekRangeInAppTimezone(fixed("2026-05-13T15:00:00.000Z"));
    expect(range).toEqual({ mondayIso: "2026-05-11", sundayIso: "2026-05-17" });
  });

  it("for a Monday, monday is the current day itself", () => {
    // 2026-05-11 is a Monday
    const range = currentWeekRangeInAppTimezone(fixed("2026-05-11T15:00:00.000Z"));
    expect(range).toEqual({ mondayIso: "2026-05-11", sundayIso: "2026-05-17" });
  });

  it("for a Sunday, sunday is the current day and monday is 6 days earlier", () => {
    // 2026-05-17 is a Sunday
    const range = currentWeekRangeInAppTimezone(fixed("2026-05-17T15:00:00.000Z"));
    expect(range).toEqual({ mondayIso: "2026-05-11", sundayIso: "2026-05-17" });
  });

  it("respects the SP timezone around UTC midnight", () => {
    // 2026-05-18T02:00:00Z = 2026-05-17T23:00:00-03:00 — still Sunday in SP
    const range = currentWeekRangeInAppTimezone(fixed("2026-05-18T02:00:00.000Z"));
    expect(range).toEqual({ mondayIso: "2026-05-11", sundayIso: "2026-05-17" });
  });

  it("transitions to the next civil week when Monday begins in SP", () => {
    // 2026-05-18T15:00:00Z = 2026-05-18T12:00:00-03:00 — Monday in SP
    const range = currentWeekRangeInAppTimezone(fixed("2026-05-18T15:00:00.000Z"));
    expect(range).toEqual({ mondayIso: "2026-05-18", sundayIso: "2026-05-24" });
  });
});
