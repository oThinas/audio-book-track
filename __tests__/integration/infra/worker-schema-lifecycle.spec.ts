import { randomUUID } from "node:crypto";

import { getPool } from "@tests/helpers/db";
import { afterAll, describe, expect, it } from "vitest";

import { buildWorkerSchemaName, createWorkerSchema, dropWorkerSchema } from "@/lib/db/test-schema";

async function schemaExists(name: string): Promise<boolean> {
  const { rows } = await getPool().query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1) AS exists",
    [name],
  );
  return rows[0]?.exists ?? false;
}

describe("createWorkerSchema / dropWorkerSchema round-trip", () => {
  const schemaName = `e2e_lifecycle_${randomUUID().replace(/-/g, "").slice(0, 8)}`;

  afterAll(async () => {
    await dropWorkerSchema(schemaName).catch(() => {});
  });

  it("creates the schema on createWorkerSchema", async () => {
    await createWorkerSchema(schemaName);
    expect(await schemaExists(schemaName)).toBe(true);
  });

  it("is idempotent on repeated create", async () => {
    await createWorkerSchema(schemaName);
    expect(await schemaExists(schemaName)).toBe(true);
  });

  it("drops the schema on dropWorkerSchema", async () => {
    await dropWorkerSchema(schemaName);
    expect(await schemaExists(schemaName)).toBe(false);
  });

  it("is idempotent on drop when schema is absent", async () => {
    await expect(dropWorkerSchema(schemaName)).resolves.toBeUndefined();
  });

  it("rejects unsafe schema names", async () => {
    await expect(createWorkerSchema("DROP TABLE users;--")).rejects.toThrow(/Invalid schema name/);
    await expect(dropWorkerSchema("DROP TABLE users;--")).rejects.toThrow(/Invalid schema name/);
  });

  it("buildWorkerSchemaName produces names accepted by createWorkerSchema", async () => {
    const generated = buildWorkerSchemaName(99);
    await createWorkerSchema(generated);
    expect(await schemaExists(generated)).toBe(true);
    await dropWorkerSchema(generated);
    expect(await schemaExists(generated)).toBe(false);
  });
});
