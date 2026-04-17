import { z } from "zod";

export const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1).optional(),
    TEST_DATABASE_URL: z.string().min(1).optional(),
    BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
    BETTER_AUTH_URL: z.string().min(1, "BETTER_AUTH_URL is required"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
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
    if (isBuildPhase && values.TEST_DATABASE_URL) return;

    if (!values.DATABASE_URL) {
      ctx.addIssue({
        code: "custom",
        message: `DATABASE_URL is required when NODE_ENV=${values.NODE_ENV}. Set it in .env.`,
        path: ["DATABASE_URL"],
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
