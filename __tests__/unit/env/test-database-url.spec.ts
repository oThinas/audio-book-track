import { describe, expect, it } from "vitest";

import { envSchema } from "@/lib/env/schema";

const baseEnv = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/audiobook_track",
  BETTER_AUTH_SECRET: "secret",
  BETTER_AUTH_URL: "http://localhost:1197",
};

describe("envSchema — TEST_DATABASE_URL constraint", () => {
  it("fails when NODE_ENV=test and TEST_DATABASE_URL is missing", () => {
    const result = envSchema.safeParse({ ...baseEnv, NODE_ENV: "test" });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("TEST_DATABASE_URL"));
      expect(issue).toBeDefined();
      expect(issue?.message).toMatch(/TEST_DATABASE_URL is required/i);
    }
  });

  it("passes when NODE_ENV=test and TEST_DATABASE_URL is provided", () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      NODE_ENV: "test",
      TEST_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/audiobook_track_test",
    });

    expect(result.success).toBe(true);
  });

  it("passes in development without TEST_DATABASE_URL", () => {
    const result = envSchema.safeParse({ ...baseEnv, NODE_ENV: "development" });

    expect(result.success).toBe(true);
  });

  it("defaults NODE_ENV to development when omitted", () => {
    const result = envSchema.safeParse(baseEnv);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe("development");
    }
  });
});
