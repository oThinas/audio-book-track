import { describe, expect, it } from "vitest";

import {
  type GroupingDimension,
  parseGroupingParam,
  serializeGroupingParam,
} from "@/lib/url/grouping-param";

describe("parseGroupingParam", () => {
  it("returns empty array when input is null (param ausente)", () => {
    expect(parseGroupingParam(null)).toEqual([]);
  });

  it("returns empty array when input is empty string", () => {
    expect(parseGroupingParam("")).toEqual([]);
  });

  it("returns single dimension for valid single token", () => {
    expect(parseGroupingParam("narrator")).toEqual(["narrator"]);
    expect(parseGroupingParam("editor")).toEqual(["editor"]);
    expect(parseGroupingParam("status")).toEqual(["status"]);
  });

  it("preserves order for valid multi-level grouping", () => {
    expect(parseGroupingParam("narrator,editor")).toEqual(["narrator", "editor"]);
    expect(parseGroupingParam("editor,narrator")).toEqual(["editor", "narrator"]);
  });

  it("supports max-depth 3-level grouping", () => {
    expect(parseGroupingParam("narrator,editor,status")).toEqual(["narrator", "editor", "status"]);
  });

  it("returns empty array for unknown token", () => {
    expect(parseGroupingParam("foo")).toEqual([]);
  });

  it("returns empty array when any token is invalid", () => {
    expect(parseGroupingParam("narrator,foo")).toEqual([]);
    expect(parseGroupingParam("foo,narrator")).toEqual([]);
  });

  it("returns empty array on duplicate tokens", () => {
    expect(parseGroupingParam("narrator,narrator")).toEqual([]);
    expect(parseGroupingParam("editor,narrator,editor")).toEqual([]);
  });

  it("trims whitespace around tokens", () => {
    expect(parseGroupingParam("narrator, editor")).toEqual(["narrator", "editor"]);
  });

  it("ignores trailing/leading commas", () => {
    expect(parseGroupingParam(",narrator,")).toEqual(["narrator"]);
  });

  it("does not throw on bizarre input", () => {
    expect(() => parseGroupingParam(";;;")).not.toThrow();
    expect(parseGroupingParam(";;;")).toEqual([]);
  });

  it("returns a new array (does not share reference)", () => {
    const a = parseGroupingParam("narrator");
    const b = parseGroupingParam("narrator");
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe("serializeGroupingParam", () => {
  it("returns null for empty array (signal to remove param)", () => {
    expect(serializeGroupingParam([])).toBeNull();
  });

  it("serializes single dimension", () => {
    expect(serializeGroupingParam(["narrator"])).toBe("narrator");
  });

  it("preserves order in multi-level", () => {
    expect(serializeGroupingParam(["narrator", "editor"])).toBe("narrator,editor");
    expect(serializeGroupingParam(["editor", "narrator"])).toBe("editor,narrator");
  });

  it("serializes max-depth", () => {
    expect(serializeGroupingParam(["narrator", "editor", "status"])).toBe("narrator,editor,status");
  });

  it("round-trip parse → serialize → parse is stable", () => {
    const input: GroupingDimension[] = ["status", "narrator"];
    const serialized = serializeGroupingParam(input);
    expect(serialized).not.toBeNull();
    expect(parseGroupingParam(serialized)).toEqual(input);
  });
});
