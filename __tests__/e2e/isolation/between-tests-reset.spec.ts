import { Pool } from "pg";

import { expect, test } from "../fixtures/app-server";

function buildPool(schemaName: string): Pool {
  const url = new URL(process.env.TEST_DATABASE_URL as string);
  url.searchParams.set("options", `-c search_path=${schemaName}`);
  return new Pool({ connectionString: url.toString() });
}

async function insertAdminPreference(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM "user" WHERE email = 'admin@audiobook.local' LIMIT 1`,
  );
  const userId = rows[0]?.id;
  if (!userId) throw new Error("admin user not found in worker schema");
  await pool.query(
    `INSERT INTO user_preference (id, user_id, theme, font_size, primary_color, favorite_page)
     VALUES (gen_random_uuid(), $1, 'dark', 'large', 'green', 'books')`,
    [userId],
  );
}

test.describe("Reset between tests (US3)", () => {
  test("first test writes into user_preference successfully", async ({ appServer }) => {
    const pool = buildPool(appServer.schemaName);
    try {
      await insertAdminPreference(pool);
      const { rows } = await pool.query<{ c: number }>(
        `SELECT count(*)::int AS c FROM user_preference`,
      );
      expect(rows[0]?.c).toBe(1);
    } finally {
      await pool.end();
    }
  });

  test("second test starts with empty user_preference (auto-reset ran) and can write the same unique row again", async ({
    appServer,
  }) => {
    const pool = buildPool(appServer.schemaName);
    try {
      const { rows: before } = await pool.query<{ c: number }>(
        `SELECT count(*)::int AS c FROM user_preference`,
      );
      expect(before[0]?.c).toBe(0);

      // Admin is preserved — user/account/session should still have rows.
      const { rows: admin } = await pool.query<{ c: number }>(
        `SELECT count(*)::int AS c FROM "user" WHERE email = 'admin@audiobook.local'`,
      );
      expect(admin[0]?.c).toBe(1);

      // Re-insertion against the same unique userId succeeds because the
      // previous row was truncated.
      await insertAdminPreference(pool);
      const { rows: after } = await pool.query<{ c: number }>(
        `SELECT count(*)::int AS c FROM user_preference`,
      );
      expect(after[0]?.c).toBe(1);
    } finally {
      await pool.end();
    }
  });
});
