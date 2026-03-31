import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { db } from "./index";

async function main() {
  console.info("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.info("Migrations completed successfully.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});