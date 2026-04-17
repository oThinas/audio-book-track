import "dotenv/config";

import { cleanOrphanSchemas } from "@/lib/db/test-schema";

const ONE_HOUR_MS = 60 * 60 * 1000;

async function main(): Promise<void> {
  const { dropped } = await cleanOrphanSchemas(ONE_HOUR_MS);
  if (dropped.length === 0) {
    console.info("No orphan test schemas found.");
    return;
  }
  console.info(`Dropped ${dropped.length} orphan schema(s):`, dropped);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("clean-orphan-schemas failed:", error);
    process.exit(1);
  });
