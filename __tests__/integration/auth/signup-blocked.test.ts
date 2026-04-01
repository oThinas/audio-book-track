import { describe, expect, it } from "vitest";

import { auth } from "@/lib/auth/server";

describe("Sign-up Blocked (FR-002) — config assertion", () => {
  it("should have sign-up disabled in emailAndPassword config", () => {
    const options = auth.options;

    expect(options.emailAndPassword).toBeDefined();
    expect(options.emailAndPassword?.disableSignUp).toBe(true);
  });

  it("should have emailAndPassword enabled for login", () => {
    const options = auth.options;

    expect(options.emailAndPassword?.enabled).toBe(true);
  });
});
