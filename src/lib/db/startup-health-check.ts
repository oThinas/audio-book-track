import { db } from "@/lib/db";
import { checkDatabaseHealth } from "@/lib/db/health-check";
import { createDatabasePing } from "@/lib/db/ping";

const MAX_RETRIES = 3;
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

export async function runStartupHealthCheck(): Promise<void> {
  const ping = createDatabasePing(db);
  const result = await checkDatabaseHealth(ping, { maxRetries: MAX_RETRIES });

  if (result.healthy) {
    console.info(`${GREEN}[health-check] Database connection verified successfully${RESET}`);
    return;
  }

  console.error(
    `${RED}[health-check] Database health check failed after ${MAX_RETRIES} attempts: ${result.error}${RESET}`,
  );
  process.exit(1);
}
