import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";

import { cleanOrphanSchemas } from "@/lib/db/test-schema";

const ONE_HOUR_MS = 60 * 60 * 1000;
const BUILD_ID_PATH = ".next/BUILD_ID";
const BUILD_FRESH_WINDOW_MS = 15 * 60 * 1000;

async function ensureNextBuild(): Promise<void> {
  if (existsSync(BUILD_ID_PATH)) {
    const age = Date.now() - statSync(BUILD_ID_PATH).mtimeMs;
    if (age < BUILD_FRESH_WINDOW_MS) {
      console.info(`Reusing .next build (${Math.round(age / 1000)}s old).`);
      return;
    }
  }

  console.info("Running `next build` so E2E workers can share a compiled app...");
  await new Promise<void>((resolve, reject) => {
    const proc = spawn("bun", ["run", "build"], {
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "production" },
    });
    proc.once("error", reject);
    proc.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`next build exited with code ${code}`));
    });
  });
}

export default async function globalSetup(): Promise<void> {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL is required for E2E. Set it in .env.test.");
  }

  await ensureNextBuild();

  const { dropped } = await cleanOrphanSchemas(ONE_HOUR_MS);
  if (dropped.length > 0) {
    console.info(`Cleaned ${dropped.length} orphan test schema(s):`, dropped);
  }
}
