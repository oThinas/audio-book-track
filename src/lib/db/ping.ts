import { sql } from "drizzle-orm";

import type { PingFn } from "./health-check";

interface DatabaseExecutor {
  execute(query: unknown): Promise<unknown>;
}

export function createDatabasePing(db: DatabaseExecutor): PingFn {
  return async () => {
    await db.execute(sql`SELECT 1`);
  };
}
