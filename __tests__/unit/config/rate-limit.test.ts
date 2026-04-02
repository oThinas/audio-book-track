import { describe, expect, it } from "vitest";

import { auth } from "@/lib/auth/server";

describe("Rate Limiting Configuration (FR-009)", () => {
  it("should have rate limiting enabled with window=60s and max=3", () => {
    const options = auth.options;

    expect(options.rateLimit).toBeDefined();
    expect(options.rateLimit?.window).toBe(60);
    expect(options.rateLimit?.max).toBe(3);
  });
});
