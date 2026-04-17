import { cleanOrphanSchemas } from "@/lib/db/test-schema";

const ONE_HOUR_MS = 60 * 60 * 1000;

export default async function globalSetup(): Promise<void> {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL is required for E2E. Set it in .env.test.");
  }

  const { dropped } = await cleanOrphanSchemas(ONE_HOUR_MS);
  if (dropped.length > 0) {
    console.info(`Cleaned ${dropped.length} orphan test schema(s):`, dropped);
  }
}
