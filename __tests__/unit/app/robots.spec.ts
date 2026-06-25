import { describe, expect, it } from "vitest";

import robots from "@/app/robots";

describe("robots metadata route", () => {
  it("returns a permissive policy allowing every user agent", () => {
    expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/" } });
  });

  it("does not block any path (no disallow)", () => {
    const { rules } = robots();

    expect(Array.isArray(rules)).toBe(false);
    expect((rules as { disallow?: unknown }).disallow).toBeUndefined();
  });

  it("does not declare a sitemap", () => {
    expect(robots().sitemap).toBeUndefined();
  });
});
