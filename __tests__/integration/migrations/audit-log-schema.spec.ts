import { getPool } from "@tests/helpers/db";
import { describe, expect, it } from "vitest";

const EXPECTED_COLUMNS = [
  "id",
  "user_id",
  "action",
  "entity_type",
  "entity_id",
  "request_id",
  "created_at",
];

const EXPECTED_INDEXES = [
  "audit_log_user_created_idx",
  "audit_log_entity_created_idx",
  "audit_log_request_id_idx",
  "audit_log_created_at_brin_idx",
];

describe("audit_log schema invariants", () => {
  it("table exists with exactly the documented columns (no PII)", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'audit_log'
         ORDER BY column_name`,
      );
      const columns = result.rows.map((r) => r.column_name).sort();
      expect(columns).toEqual([...EXPECTED_COLUMNS].sort());
    } finally {
      client.release();
    }
  });

  it("has the 4 required indexes (user, entity, request_id, BRIN)", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await client.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes
         WHERE schemaname = current_schema() AND tablename = 'audit_log'`,
      );
      const names = result.rows.map((r) => r.indexname);
      for (const expected of EXPECTED_INDEXES) {
        expect(names).toContain(expected);
      }
    } finally {
      client.release();
    }
  });

  it("uses BRIN access method on the time-series index", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await client.query<{ amname: string }>(
        `SELECT am.amname FROM pg_class c
         JOIN pg_am am ON c.relam = am.oid
         WHERE c.relname = 'audit_log_created_at_brin_idx'`,
      );
      expect(result.rows[0]?.amname).toBe("brin");
    } finally {
      client.release();
    }
  });
});
