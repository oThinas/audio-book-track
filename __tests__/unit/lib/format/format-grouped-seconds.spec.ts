import { describe, expect, it } from "vitest";

import { formatGroupedSeconds } from "@/lib/utils";

describe("formatGroupedSeconds", () => {
  it("retorna '0min' para soma zero", () => {
    expect(formatGroupedSeconds(0)).toBe("0min");
  });

  it("retorna 'Ymin' quando há apenas minutos (hours = 0)", () => {
    expect(formatGroupedSeconds(60)).toBe("1min");
    expect(formatGroupedSeconds(120)).toBe("2min");
    expect(formatGroupedSeconds(1380)).toBe("23min"); // 23min
  });

  it("retorna 'Xh' quando há apenas horas exatas (minutes = 0)", () => {
    expect(formatGroupedSeconds(3600)).toBe("1h");
    expect(formatGroupedSeconds(7200)).toBe("2h");
    expect(formatGroupedSeconds(10800)).toBe("3h");
  });

  it("retorna 'Xh Ymin' quando há ambos", () => {
    expect(formatGroupedSeconds(5040)).toBe("1h 24min"); // 1h 24min = 3600 + 1440
    expect(formatGroupedSeconds(3660)).toBe("1h 1min");
    expect(formatGroupedSeconds(7320)).toBe("2h 2min");
  });

  it("trunca segundos parciais (não arredonda minutos)", () => {
    // 1h 1min 59s → "1h 1min" (não "1h 2min")
    expect(formatGroupedSeconds(3719)).toBe("1h 1min");
    // 59s → "0min" (não "1min")
    expect(formatGroupedSeconds(59)).toBe("0min");
  });

  it("não acumula erro em valores grandes", () => {
    // 100h exato → "100h"
    expect(formatGroupedSeconds(360_000)).toBe("100h");
    // 100h 30min
    expect(formatGroupedSeconds(361_800)).toBe("100h 30min");
  });

  it("lança erro para entrada não-finita ou negativa", () => {
    expect(() => formatGroupedSeconds(-1)).toThrow();
    expect(() => formatGroupedSeconds(Number.NaN)).toThrow();
    expect(() => formatGroupedSeconds(Number.POSITIVE_INFINITY)).toThrow();
  });
});
