import { describe, expect, it } from "vitest";

import { envSchema } from "@/lib/env/schema";

const baseProdEnv = {
  BETTER_AUTH_SECRET: "secret",
  BETTER_AUTH_URL: "http://localhost:1197",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/audiobook_track",
  NODE_ENV: "production" as const,
  SENTRY_DSN: "https://abc@o123.ingest.sentry.io/456",
  CRON_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef",
};

const baseDevEnv = {
  BETTER_AUTH_SECRET: "secret",
  BETTER_AUTH_URL: "http://localhost:1197",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/audiobook_track",
  NODE_ENV: "development" as const,
};

describe("envSchema — observability fields", () => {
  it("fails when NODE_ENV=production and SENTRY_DSN is missing", () => {
    const { SENTRY_DSN, ...env } = baseProdEnv;
    void SENTRY_DSN;

    const result = envSchema.safeParse(env);

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("SENTRY_DSN"));
      expect(issue).toBeDefined();
    }
  });

  it("fails when NODE_ENV=production and CRON_SECRET is missing", () => {
    const { CRON_SECRET, ...env } = baseProdEnv;
    void CRON_SECRET;

    const result = envSchema.safeParse(env);

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("CRON_SECRET"));
      expect(issue).toBeDefined();
    }
  });

  it("fails when NODE_ENV=production and CRON_SECRET is shorter than 32 chars", () => {
    const result = envSchema.safeParse({
      ...baseProdEnv,
      CRON_SECRET: "too-short",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("CRON_SECRET"));
      expect(issue).toBeDefined();
    }
  });

  it("passes in development without SENTRY_DSN or CRON_SECRET", () => {
    const result = envSchema.safeParse(baseDevEnv);
    expect(result.success).toBe(true);
  });

  it("passes in production with valid SENTRY_DSN and CRON_SECRET >= 32 chars", () => {
    const result = envSchema.safeParse(baseProdEnv);
    expect(result.success).toBe(true);
  });

  it("accepts optional APP_VERSION", () => {
    const result = envSchema.safeParse({ ...baseDevEnv, APP_VERSION: "1.2.3" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.APP_VERSION).toBe("1.2.3");
    }
  });
});
