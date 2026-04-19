import { getPool } from "@tests/helpers/db";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";

import { checkDatabaseConnection } from "@/lib/db/health-check";
import { createDatabasePing } from "@/lib/db/ping";

describe("Database Health Check Integration", () => {
  it("should return healthy with real database connection", async () => {
    const pool = getPool();
    const db = drizzle(pool);
    const ping = createDatabasePing(db);

    const result = await checkDatabaseConnection(ping, 5000);

    expect(result).toEqual({ healthy: true });
  });

  it("should execute SELECT 1 successfully via createDatabasePing", async () => {
    const pool = getPool();
    const db = drizzle(pool);
    const ping = createDatabasePing(db);

    await expect(ping()).resolves.toBeUndefined();
  });
});
