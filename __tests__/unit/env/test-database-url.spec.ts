import { afterEach, describe, expect, it } from "vitest";

import { envSchema } from "@/lib/env/schema";

const authEnv = {
  BETTER_AUTH_SECRET: "secret",
  BETTER_AUTH_URL: "http://localhost:1197",
};

const devUrl = "postgresql://postgres:postgres@localhost:5432/audiobook_track";
const testUrl = "postgresql://postgres:postgres@localhost:5432/audiobook_track_test";

describe("envSchema — conditional URL requirements", () => {
  it("fails when NODE_ENV=test and TEST_DATABASE_URL is missing", () => {
    const result = envSchema.safeParse({ ...authEnv, NODE_ENV: "test" });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("TEST_DATABASE_URL"));
      expect(issue).toBeDefined();
      expect(issue?.message).toMatch(/TEST_DATABASE_URL is required/i);
    }
  });

  it("passes when NODE_ENV=test and only TEST_DATABASE_URL is set (DATABASE_URL may be absent)", () => {
    const result = envSchema.safeParse({
      ...authEnv,
      NODE_ENV: "test",
      TEST_DATABASE_URL: testUrl,
    });

    expect(result.success).toBe(true);
  });

  it("fails when NODE_ENV=development and DATABASE_URL is missing", () => {
    const result = envSchema.safeParse({ ...authEnv, NODE_ENV: "development" });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("DATABASE_URL"));
      expect(issue).toBeDefined();
      expect(issue?.message).toMatch(/DATABASE_URL is required/i);
    }
  });

  it("fails when NODE_ENV=production and DATABASE_URL is missing", () => {
    const result = envSchema.safeParse({ ...authEnv, NODE_ENV: "production" });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("DATABASE_URL"));
      expect(issue).toBeDefined();
    }
  });

  it("passes in development with DATABASE_URL set", () => {
    const result = envSchema.safeParse({
      ...authEnv,
      NODE_ENV: "development",
      DATABASE_URL: devUrl,
    });

    expect(result.success).toBe(true);
  });

  it("defaults NODE_ENV to development when omitted", () => {
    const result = envSchema.safeParse({ ...authEnv, DATABASE_URL: devUrl });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe("development");
    }
  });

  describe("during next build (NEXT_PHASE=phase-production-build)", () => {
    const originalPhase = process.env.NEXT_PHASE;

    afterEach(() => {
      if (originalPhase === undefined) delete process.env.NEXT_PHASE;
      else process.env.NEXT_PHASE = originalPhase;
    });

    it("passes with no DATABASE_URL and no TEST_DATABASE_URL", () => {
      process.env.NEXT_PHASE = "phase-production-build";
      const result = envSchema.safeParse({ ...authEnv, NODE_ENV: "production" });
      expect(result.success).toBe(true);
    });

    it("passes in test mode without TEST_DATABASE_URL", () => {
      process.env.NEXT_PHASE = "phase-production-build";
      const result = envSchema.safeParse({ ...authEnv, NODE_ENV: "test" });
      expect(result.success).toBe(true);
    });
  });
});
