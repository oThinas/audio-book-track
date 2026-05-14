import { describe, expect, it } from "vitest";

import {
  APP_TIMEZONE,
  currentWeekRangeInAppTimezone,
  todayInAppTimezone,
} from "@/lib/domain/timezone";

const fixed = (iso: string) => () => new Date(iso);

describe("APP_TIMEZONE", () => {
  it('é a constante "America/Sao_Paulo"', () => {
    expect(APP_TIMEZONE).toBe("America/Sao_Paulo");
  });
});

describe("todayInAppTimezone", () => {
  it('retorna "YYYY-MM-DD" em America/Sao_Paulo para meio-dia UTC', () => {
    expect(todayInAppTimezone(fixed("2026-05-14T15:00:00.000Z"))).toBe("2026-05-14");
  });

  it("retorna o dia anterior quando UTC já virou mas SP ainda não (madrugada UTC)", () => {
    // 2026-05-14T02:00:00Z = 2026-05-13T23:00:00-03:00 (SP)
    expect(todayInAppTimezone(fixed("2026-05-14T02:00:00.000Z"))).toBe("2026-05-13");
  });

  it("retorna o dia corrente quando UTC e SP estão no mesmo dia (manhã SP)", () => {
    // 2026-05-14T12:00:00Z = 2026-05-14T09:00:00-03:00 (SP)
    expect(todayInAppTimezone(fixed("2026-05-14T12:00:00.000Z"))).toBe("2026-05-14");
  });

  it("usa o relógio do sistema quando nenhum now é passado", () => {
    const value = todayInAppTimezone();
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("currentWeekRangeInAppTimezone", () => {
  it("para uma quarta-feira, retorna seg-dom corretos (seg=1)", () => {
    // 2026-05-13 é quarta-feira
    const range = currentWeekRangeInAppTimezone(fixed("2026-05-13T15:00:00.000Z"));
    expect(range).toEqual({ mondayIso: "2026-05-11", sundayIso: "2026-05-17" });
  });

  it("para uma segunda-feira, monday é o próprio dia", () => {
    // 2026-05-11 é segunda
    const range = currentWeekRangeInAppTimezone(fixed("2026-05-11T15:00:00.000Z"));
    expect(range).toEqual({ mondayIso: "2026-05-11", sundayIso: "2026-05-17" });
  });

  it("para um domingo, sunday é o próprio dia e monday é 6 dias antes", () => {
    // 2026-05-17 é domingo
    const range = currentWeekRangeInAppTimezone(fixed("2026-05-17T15:00:00.000Z"));
    expect(range).toEqual({ mondayIso: "2026-05-11", sundayIso: "2026-05-17" });
  });

  it("respeita o fuso de SP ao redor da meia-noite", () => {
    // 2026-05-18T02:00:00Z = 2026-05-17T23:00:00-03:00 — ainda domingo em SP
    const range = currentWeekRangeInAppTimezone(fixed("2026-05-18T02:00:00.000Z"));
    expect(range).toEqual({ mondayIso: "2026-05-11", sundayIso: "2026-05-17" });
  });

  it("transita para a próxima semana civil ao virar segunda em SP", () => {
    // 2026-05-18T15:00:00Z = 2026-05-18T12:00:00-03:00 — segunda em SP
    const range = currentWeekRangeInAppTimezone(fixed("2026-05-18T15:00:00.000Z"));
    expect(range).toEqual({ mondayIso: "2026-05-18", sundayIso: "2026-05-24" });
  });
});
