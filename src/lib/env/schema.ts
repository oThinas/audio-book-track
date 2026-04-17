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
    // Next.js runs `next build` with NODE_ENV=production and imports route
    // handlers to collect page data — no DB connection happens during this
    // phase. Skip database URL enforcement here; the runtime still parses
    // env when the server actually starts and will fail loudly if the URL
    // for the active NODE_ENV is missing.
    if (process.env.NEXT_PHASE === "phase-production-build") return;

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
    if (!values.DATABASE_URL) {
      ctx.addIssue({
        code: "custom",
        message: `DATABASE_URL is required when NODE_ENV=${values.NODE_ENV}. Set it in .env.`,
        path: ["DATABASE_URL"],
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
