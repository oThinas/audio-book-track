import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "@/lib/db/schema";
import type { RepositoryTx } from "@/lib/repositories/book-repository";
import type { UnitOfWork } from "@/lib/repositories/unit-of-work";

type Executor = NodePgDatabase<typeof schema>;

export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Executor) {}

  transaction<T>(callback: (tx: RepositoryTx) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => callback(tx));
  }
}
