import { describe, expect, it } from "vitest";

import { densifyPositions } from "@/lib/domain/normalize-positions";

describe("densifyPositions", () => {
  it("retorna lista vazia para entrada vazia", () => {
    expect(densifyPositions([])).toEqual([]);
  });

  it("retorna position 0 para item único", () => {
    expect(densifyPositions([{ id: "a" }])).toEqual([{ id: "a", position: 0 }]);
  });

  it("atribui positions 0..N-1 preservando ordem", () => {
    expect(densifyPositions([{ id: "a" }, { id: "b" }, { id: "c" }])).toEqual([
      { id: "a", position: 0 },
      { id: "b", position: 1 },
      { id: "c", position: 2 },
    ]);
  });

  it("preserva ordem original mesmo com 50 items", () => {
    const input = Array.from({ length: 50 }, (_, i) => ({ id: `id-${i}` }));
    const result = densifyPositions(input);
    expect(result).toHaveLength(50);
    expect(result[0]).toEqual({ id: "id-0", position: 0 });
    expect(result[49]).toEqual({ id: "id-49", position: 49 });
  });

  it("é puro (não muta entrada)", () => {
    const input = [{ id: "a" }, { id: "b" }];
    const snapshot = JSON.parse(JSON.stringify(input));
    densifyPositions(input);
    expect(input).toEqual(snapshot);
  });

  it("aceita objetos com campos extras (tipo genérico)", () => {
    const result = densifyPositions([
      { id: "a", extra: 1 },
      { id: "b", extra: 2 },
    ]);
    expect(result).toEqual([
      { id: "a", position: 0 },
      { id: "b", position: 1 },
    ]);
  });
});
