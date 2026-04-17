import { randomUUID } from "node:crypto";

import { getPool } from "@tests/helpers/db";
import { afterEach, describe, expect, it } from "vitest";

import { cleanOrphanSchemas, createWorkerSchema, dropWorkerSchema } from "@/lib/db/test-schema";

async function schemaExists(name: string): Promise<boolean> {
  const { rows } = await getPool().query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1) AS exists",
    [name],
  );
  return rows[0]?.exists ?? false;
}

async function setSchemaCreatedAt(name: string, isoTimestamp: string): Promise<void> {
  const comment = `created_at:${isoTimestamp}`.replace(/'/g, "''");
  await getPool().query(`COMMENT ON SCHEMA "${name}" IS '${comment}'`);
}

describe("cleanOrphanSchemas", () => {
  const freshName = `e2e_fresh_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
  const orphanName = `e2e_orphan_${randomUUID().replace(/-/g, "").slice(0, 8)}`;

  afterEach(async () => {
    await dropWorkerSchema(freshName).catch(() => {});
    await dropWorkerSchema(orphanName).catch(() => {});
  });

  it("drops schemas older than the threshold and preserves fresh ones", async () => {
    await createWorkerSchema(freshName);
    await createWorkerSchema(orphanName);
    await setSchemaCreatedAt(orphanName, new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

    const { dropped } = await cleanOrphanSchemas(60 * 60 * 1000);

    expect(dropped).toContain(orphanName);
    expect(dropped).not.toContain(freshName);
    expect(await schemaExists(orphanName)).toBe(false);
    expect(await schemaExists(freshName)).toBe(true);
  });

  it("drops nothing when all e2e_* schemas are fresh", async () => {
    await createWorkerSchema(freshName);

    const { dropped } = await cleanOrphanSchemas(60 * 60 * 1000);

    expect(dropped).not.toContain(freshName);
    expect(await schemaExists(freshName)).toBe(true);
  });

  it("ignores schemas without the created_at comment", async () => {
    await getPool().query(`CREATE SCHEMA IF NOT EXISTS "${orphanName}"`);

    const { dropped } = await cleanOrphanSchemas(60 * 60 * 1000);

    expect(dropped).not.toContain(orphanName);
    expect(await schemaExists(orphanName)).toBe(true);
  });
});
