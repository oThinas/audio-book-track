import type { TestDb } from "@tests/helpers/db";
import { sql } from "drizzle-orm";

import type { RepositoryTx } from "@/lib/repositories/book-repository";
import type { UnitOfWork } from "@/lib/repositories/unit-of-work";

/**
 * Passes the callback through without starting a nested transaction.
 * Intended for unit tests wired to in-memory repos where no real transaction exists.
 */
export class NoOpUnitOfWork implements UnitOfWork {
  async transaction<T>(callback: (tx: RepositoryTx) => Promise<T>): Promise<T> {
    return callback(undefined);
  }
}

/**
 * SAVEPOINT-based UoW for integration tests.
 *
 * The integration suite wraps every test in an outer BEGIN/ROLLBACK on a
 * single PoolClient. A nested `db.transaction()` from DrizzleUnitOfWork would
 * issue a second BEGIN — Postgres silently ignores it and a later COMMIT
 * commits the outer transaction, corrupting the per-test rollback.
 *
 * SAVEPOINTs solve both problems: the inner operation is scoped, errors
 * (e.g. UNIQUE violations → state 25P02) can be recovered from via
 * ROLLBACK TO SAVEPOINT, and the outer ROLLBACK still fires at test end.
 */
export class SavepointUnitOfWork implements UnitOfWork {
  constructor(private readonly db: TestDb) {}

  async transaction<T>(callback: (_tx: RepositoryTx) => Promise<T>): Promise<T> {
    const name = `sp_${crypto.randomUUID().replace(/-/g, "")}`;
    await this.db.execute(sql.raw(`SAVEPOINT ${name}`));
    try {
      const result = await callback(this.db);
      await this.db.execute(sql.raw(`RELEASE SAVEPOINT ${name}`));
      return result;
    } catch (error) {
      await this.db.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${name}`));
      throw error;
    }
  }
}
