import { describe, expect, it } from "vitest";

import { parseFocusParam, serializeFocusParam } from "@/lib/url/focus-param";

describe("parseFocusParam", () => {
  it('retorna "week" quando focus=week', () => {
    expect(parseFocusParam(new URLSearchParams("?focus=week"))).toBe("week");
  });

  it("retorna null quando param ausente", () => {
    expect(parseFocusParam(new URLSearchParams(""))).toBeNull();
  });

  it("retorna null para valores desconhecidos", () => {
    expect(parseFocusParam(new URLSearchParams("?focus=banana"))).toBeNull();
    expect(parseFocusParam(new URLSearchParams("?focus="))).toBeNull();
    expect(parseFocusParam(new URLSearchParams("?focus=Week"))).toBeNull();
  });
});

describe("serializeFocusParam", () => {
  it('serializa "week" como "week"', () => {
    expect(serializeFocusParam("week")).toBe("week");
  });

  it("serializa null como null (sinaliza remoção do param)", () => {
    expect(serializeFocusParam(null)).toBeNull();
  });
});
