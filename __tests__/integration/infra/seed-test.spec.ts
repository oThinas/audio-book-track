import { randomUUID } from "node:crypto";

import { getPool } from "@tests/helpers/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runMigrations } from "@/lib/db/migrate";
import { seedAdmin } from "@/lib/db/seed-test";
import { createWorkerSchema, dropWorkerSchema } from "@/lib/db/test-schema";

const schemaName = `e2e_seed_${randomUUID().replace(/-/g, "").slice(0, 8)}`;

async function countRows(table: string): Promise<number> {
  const { rows } = await getPool().query<{ c: number }>(
    `SELECT count(*)::int AS c FROM "${schemaName}"."${table}"`,
  );
  return rows[0]?.c ?? 0;
}

describe("seed-test bootstrap", () => {
  beforeAll(async () => {
    await createWorkerSchema(schemaName);
    const testUrl = process.env.TEST_DATABASE_URL;
    if (!testUrl) throw new Error("TEST_DATABASE_URL is required for seed-test integration.");
    await runMigrations({ url: testUrl, schema: schemaName });
    await seedAdmin({ url: testUrl, schema: schemaName });
  });

  afterAll(async () => {
    await dropWorkerSchema(schemaName).catch(() => {});
  });

  it("creates exactly one admin user row with the expected credentials", async () => {
    const { rows } = await getPool().query<{ id: string; email: string; name: string }>(
      `SELECT id, email, name FROM "${schemaName}"."user"`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("admin@audiobook.local");
    expect(rows[0]?.name).toBe("Administrador");
  });

  it("creates exactly one account row linked to the admin", async () => {
    expect(await countRows("account")).toBe(1);

    const { rows } = await getPool().query<{ user_id: string }>(
      `SELECT user_id FROM "${schemaName}"."account"`,
    );
    const { rows: userRows } = await getPool().query<{ id: string }>(
      `SELECT id FROM "${schemaName}"."user"`,
    );
    expect(rows[0]?.user_id).toBe(userRows[0]?.id);
  });

  it("does not insert rows into domain tables", async () => {
    expect(await countRows("user_preference")).toBe(0);
    expect(await countRows("verification")).toBe(0);
  });

  it("is idempotent — calling seedAdmin again does not duplicate the admin", async () => {
    const testUrl = process.env.TEST_DATABASE_URL as string;
    await seedAdmin({ url: testUrl, schema: schemaName });

    expect(await countRows("user")).toBe(1);
    expect(await countRows("account")).toBe(1);
  });
});
