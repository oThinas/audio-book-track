import { z } from "zod";

export const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1).optional(),
    TEST_DATABASE_URL: z.string().min(1).optional(),
    BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
    BETTER_AUTH_URL: z.string().min(1, "BETTER_AUTH_URL is required"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    // Observabilidade (obrigatório em production; opcional em dev/test)
    SENTRY_DSN: z.string().min(1).optional(),
    SENTRY_ORG: z.string().min(1).optional(),
    SENTRY_PROJECT: z.string().min(1).optional(),
    SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
    CRON_SECRET: z.string().min(32, "CRON_SECRET deve ter pelo menos 32 caracteres").optional(),
    APP_VERSION: z.string().min(1).optional(),
  })
  .superRefine((values, ctx) => {
    if (values.NODE_ENV === "test") {
      if (!values.TEST_DATABASE_URL) {
        ctx.addIssue({
          code: "custom",
          message:
            "TEST_DATABASE_URL is required when NODE_ENV=test. Add it to .env.test (see .env.test.example).",
          path: ["TEST_DATABASE_URL"],
        });
      }
      return;
    }

    // During `next build` for the E2E suite, Next.js forces NODE_ENV to
    // production but only TEST_DATABASE_URL is present. No DB connection
    // happens — route handlers are imported to collect page data, and
    // runtime workers override DATABASE_URL per worker. Accept the build
    // only when the caller is clearly a test harness (TEST_DATABASE_URL
    // set); real production builds still require DATABASE_URL.
    const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
    const isTestHarnessBuild = isBuildPhase && Boolean(values.TEST_DATABASE_URL);

    if (!isTestHarnessBuild && !values.DATABASE_URL) {
      ctx.addIssue({
        code: "custom",
        message: `DATABASE_URL is required when NODE_ENV=${values.NODE_ENV}. Set it in .env.`,
        path: ["DATABASE_URL"],
      });
    }

    // Skip Sentry/CRON checks during `next build` — these are runtime-only
    // secrets and not available at build time on Vercel. Runtime checks
    // happen when the env is parsed by serverless handlers.
    if (values.NODE_ENV === "production" && !isBuildPhase) {
      if (!values.SENTRY_DSN) {
        ctx.addIssue({
          code: "custom",
          message: "Configure SENTRY_DSN antes do deploy em produção (ver docs/deploy.md §3).",
          path: ["SENTRY_DSN"],
        });
      }
      if (!values.CRON_SECRET) {
        ctx.addIssue({
          code: "custom",
          message:
            "Configure CRON_SECRET (>= 32 chars) antes do deploy em produção (ver docs/deploy.md §3).",
          path: ["CRON_SECRET"],
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;
