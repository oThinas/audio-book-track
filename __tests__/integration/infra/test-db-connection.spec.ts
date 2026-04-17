import { getPool } from "@tests/helpers/db";
import { describe, expect, it } from "vitest";

import { env } from "@/lib/env";

describe("Integration test connection target", () => {
  it("connects to TEST_DATABASE_URL, not DATABASE_URL", () => {
    expect(env.TEST_DATABASE_URL).toBeDefined();
    expect(env.TEST_DATABASE_URL).not.toBe(env.DATABASE_URL);
  });

  it("reports current_database matching TEST_DATABASE_URL path", async () => {
    const expected = new URL(env.TEST_DATABASE_URL as string).pathname.replace(/^\//, "");
    const { rows } = await getPool().query<{ db: string }>("SELECT current_database() AS db");

    expect(rows[0]?.db).toBe(expected);
  });

  it("reports current_schema as public", async () => {
    const { rows } = await getPool().query<{ schema: string }>("SELECT current_schema() AS schema");

    expect(rows[0]?.schema).toBe("public");
  });
});
