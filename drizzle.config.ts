import "dotenv/config";
import { defineConfig } from "drizzle-kit";

import { env } from "./src/lib/env";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // drizzle-kit only runs outside of tests; env schema guarantees DATABASE_URL
    // is defined when NODE_ENV !== "test". Non-null tightens the type without
    // duplicating the Zod-enforced invariant.
    url: env.DATABASE_URL as string,
  },
});
