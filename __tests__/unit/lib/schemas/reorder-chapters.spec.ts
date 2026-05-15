import { describe, expect, it } from "vitest";

import { reorderChaptersSchema } from "@/lib/schemas/chapter";

describe("reorderChaptersSchema", () => {
  it("aceita lista de uuids únicos com expectedVersion", () => {
    const parsed = reorderChaptersSchema.parse({
      orderedIds: ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"],
      expectedVersion: 0,
    });
    expect(parsed.orderedIds).toHaveLength(2);
    expect(parsed.expectedVersion).toBe(0);
  });

  it("rejeita lista vazia", () => {
    expect(() => reorderChaptersSchema.parse({ orderedIds: [], expectedVersion: 0 })).toThrow();
  });

  it("rejeita duplicatas", () => {
    expect(() =>
      reorderChaptersSchema.parse({
        orderedIds: [
          "00000000-0000-4000-8000-000000000001",
          "00000000-0000-4000-8000-000000000001",
        ],
        expectedVersion: 0,
      }),
    ).toThrow();
  });

  it("rejeita itens não-uuid", () => {
    expect(() =>
      reorderChaptersSchema.parse({ orderedIds: ["not-a-uuid"], expectedVersion: 0 }),
    ).toThrow();
  });

  it("rejeita expectedVersion negativo", () => {
    expect(() =>
      reorderChaptersSchema.parse({
        orderedIds: ["00000000-0000-4000-8000-000000000001"],
        expectedVersion: -1,
      }),
    ).toThrow();
  });

  it("rejeita expectedVersion não-inteiro", () => {
    expect(() =>
      reorderChaptersSchema.parse({
        orderedIds: ["00000000-0000-4000-8000-000000000001"],
        expectedVersion: 1.5,
      }),
    ).toThrow();
  });
});
