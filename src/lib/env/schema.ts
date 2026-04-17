import { z } from "zod";

export const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    TEST_DATABASE_URL: z.string().min(1).optional(),
    BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
    BETTER_AUTH_URL: z.string().min(1, "BETTER_AUTH_URL is required"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  })
  .superRefine((values, ctx) => {
    if (values.NODE_ENV === "test" && !values.TEST_DATABASE_URL) {
      ctx.addIssue({
        code: "custom",
        message:
          "TEST_DATABASE_URL is required when NODE_ENV=test. Add it to .env.test (see .env.test.example).",
        path: ["TEST_DATABASE_URL"],
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
