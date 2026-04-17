import { describe, expect, it } from "vitest";

import { parseMigrateArgs } from "@/lib/db/migrate";

describe("parseMigrateArgs", () => {
  it("returns empty object when no flags are passed", () => {
    expect(parseMigrateArgs([])).toEqual({});
  });

  it("parses --url flag", () => {
    const url = "postgresql://postgres:postgres@localhost:5432/audiobook_track_test";

    expect(parseMigrateArgs(["--url", url])).toEqual({ url });
  });

  it("parses --schema flag", () => {
    expect(parseMigrateArgs(["--schema", "e2e_w0_abc123de"])).toEqual({
      schema: "e2e_w0_abc123de",
    });
  });

  it("parses both --url and --schema in any order", () => {
    const url = "postgresql://postgres:postgres@localhost:5432/audiobook_track_test";

    expect(parseMigrateArgs(["--url", url, "--schema", "e2e_w1_deadbeef"])).toEqual({
      url,
      schema: "e2e_w1_deadbeef",
    });
    expect(parseMigrateArgs(["--schema", "e2e_w1_deadbeef", "--url", url])).toEqual({
      url,
      schema: "e2e_w1_deadbeef",
    });
  });

  it("throws when a flag is missing its value", () => {
    expect(() => parseMigrateArgs(["--url"])).toThrow(/--url/);
    expect(() => parseMigrateArgs(["--schema"])).toThrow(/--schema/);
  });

  it("throws on unknown flags so typos are caught early", () => {
    expect(() => parseMigrateArgs(["--db", "x"])).toThrow(/unknown/i);
  });
});
