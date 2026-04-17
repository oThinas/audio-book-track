import { describe, expect, it } from "vitest";

import { buildWorkerSchemaName } from "@/lib/db/test-schema";

const SCHEMA_NAME_PATTERN = /^e2e_w\d+_[a-f0-9]{8}$/;

describe("buildWorkerSchemaName", () => {
  it("returns a name matching e2e_w{index}_{shortUuid}", () => {
    const name = buildWorkerSchemaName(0);

    expect(name).toMatch(SCHEMA_NAME_PATTERN);
  });

  it("encodes the worker index in the name", () => {
    expect(buildWorkerSchemaName(3).startsWith("e2e_w3_")).toBe(true);
    expect(buildWorkerSchemaName(12).startsWith("e2e_w12_")).toBe(true);
  });

  it("produces distinct suffixes across calls to avoid collisions with orphan schemas", () => {
    const names = new Set(Array.from({ length: 10 }, () => buildWorkerSchemaName(0)));

    expect(names.size).toBeGreaterThan(1);
  });

  it("rejects negative worker indices", () => {
    expect(() => buildWorkerSchemaName(-1)).toThrow();
  });
});
