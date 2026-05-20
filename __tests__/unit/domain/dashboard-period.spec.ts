import { describe, expect, it } from "vitest";

import { getPresetRange, parsePeriodSearchParams } from "@/lib/domain/dashboard-period";

describe("getPresetRange", () => {
  it("returns the same day for 'today'", () => {
    expect(getPresetRange("today", "2026-05-19")).toEqual({
      fromIso: "2026-05-19",
      toIso: "2026-05-19",
      preset: "today",
    });
  });

  it("returns Monday–Sunday of the calendar week for 'this-week'", () => {
    // 2026-05-19 is a Tuesday → week is 2026-05-18 (Mon) to 2026-05-24 (Sun)
    expect(getPresetRange("this-week", "2026-05-19")).toEqual({
      fromIso: "2026-05-18",
      toIso: "2026-05-24",
      preset: "this-week",
    });
  });

  it("returns first–last day of month for 'this-month'", () => {
    expect(getPresetRange("this-month", "2026-05-19")).toEqual({
      fromIso: "2026-05-01",
      toIso: "2026-05-31",
      preset: "this-month",
    });
  });

  it("returns first–last day of quarter for 'this-quarter'", () => {
    // May 2026 → Q2 (Apr 1 – Jun 30)
    expect(getPresetRange("this-quarter", "2026-05-19")).toEqual({
      fromIso: "2026-04-01",
      toIso: "2026-06-30",
      preset: "this-quarter",
    });
  });

  it("returns Jan 1–Dec 31 for 'this-year'", () => {
    expect(getPresetRange("this-year", "2026-05-19")).toEqual({
      fromIso: "2026-01-01",
      toIso: "2026-12-31",
      preset: "this-year",
    });
  });
});

describe("parsePeriodSearchParams", () => {
  const todayIso = "2026-05-19";

  it("returns preset range when preset is provided", () => {
    const params = new URLSearchParams({ preset: "this-month" });
    expect(parsePeriodSearchParams(params, todayIso)).toEqual({
      fromIso: "2026-05-01",
      toIso: "2026-05-31",
      preset: "this-month",
    });
  });

  it("returns custom range when from/to provided", () => {
    const params = new URLSearchParams({ from: "2026-01-01", to: "2026-03-31" });
    expect(parsePeriodSearchParams(params, todayIso)).toEqual({
      fromIso: "2026-01-01",
      toIso: "2026-03-31",
      preset: "custom",
    });
  });

  it("falls back to this-month when params are empty", () => {
    const params = new URLSearchParams();
    expect(parsePeriodSearchParams(params, todayIso)).toEqual({
      fromIso: "2026-05-01",
      toIso: "2026-05-31",
      preset: "this-month",
    });
  });

  it("falls back when from > to", () => {
    const params = new URLSearchParams({ from: "2026-05-31", to: "2026-05-01" });
    expect(parsePeriodSearchParams(params, todayIso).preset).toBe("this-month");
  });

  it("falls back on malformed dates", () => {
    const params = new URLSearchParams({ from: "not-a-date", to: "2026-05-01" });
    expect(parsePeriodSearchParams(params, todayIso).preset).toBe("this-month");
  });
});
