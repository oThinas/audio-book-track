import { describe, expect, it } from "vitest";

import { parseFocusParam, serializeFocusParam } from "@/lib/url/focus-param";

describe("parseFocusParam", () => {
  it('returns "week" when focus=week', () => {
    expect(parseFocusParam(new URLSearchParams("?focus=week"))).toBe("week");
  });

  it("returns null when the param is absent", () => {
    expect(parseFocusParam(new URLSearchParams(""))).toBeNull();
  });

  it("returns null for unknown values", () => {
    expect(parseFocusParam(new URLSearchParams("?focus=banana"))).toBeNull();
    expect(parseFocusParam(new URLSearchParams("?focus="))).toBeNull();
    expect(parseFocusParam(new URLSearchParams("?focus=Week"))).toBeNull();
  });
});

describe("serializeFocusParam", () => {
  it('serializes "week" as "week"', () => {
    expect(serializeFocusParam("week")).toBe("week");
  });

  it("serializes null as null (signals removal of the param)", () => {
    expect(serializeFocusParam(null)).toBeNull();
  });
});
