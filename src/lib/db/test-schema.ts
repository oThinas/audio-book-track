import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import { env } from "@/lib/env";

const SCHEMA_NAME_REGEX = /^[a-z][a-z0-9_]*$/;
const CREATED_AT_COMMENT_PREFIX = "created_at:";

interface SchemaOp {
  readonly url?: string;
}

export function buildWorkerSchemaName(workerIndex: number): string {
  if (!Number.isInteger(workerIndex) || workerIndex < 0) {
    throw new Error(`workerIndex must be a non-negative integer (got ${workerIndex})`);
  }
  const shortUuid = randomUUID().replace(/-/g, "").slice(0, 8);
  return `e2e_w${workerIndex}_${shortUuid}`;
}

function resolveTestUrl(url?: string): string {
  const target = url ?? env.TEST_DATABASE_URL;
  if (!target) {
    throw new Error(
      "TEST_DATABASE_URL is required for test schema operations. Set it in .env.test.",
    );
  }
  if (target === env.DATABASE_URL) {
    throw new Error(
      "Refusing to operate on DATABASE_URL. Test schemas must only live in TEST_DATABASE_URL.",
    );
  }
  return target;
}

function assertSchemaName(name: string): void {
  if (!SCHEMA_NAME_REGEX.test(name)) {
    throw new Error(
      `Invalid schema name: ${name}. Must match /^[a-z][a-z0-9_]*$/ (no quoting needed).`,
    );
  }
}

export async function createWorkerSchema(
  schemaName: string,
  options: SchemaOp = {},
): Promise<void> {
  assertSchemaName(schemaName);
  const pool = new Pool({ connectionString: resolveTestUrl(options.url) });
  try {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    const comment = `${CREATED_AT_COMMENT_PREFIX}${new Date().toISOString()}`;
    const escaped = comment.replace(/'/g, "''");
    await pool.query(`COMMENT ON SCHEMA "${schemaName}" IS '${escaped}'`);
  } finally {
    await pool.end();
  }
}

export async function dropWorkerSchema(schemaName: string, options: SchemaOp = {}): Promise<void> {
  assertSchemaName(schemaName);
  const pool = new Pool({ connectionString: resolveTestUrl(options.url) });
  try {
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  } finally {
    await pool.end();
  }
}

export async function cleanOrphanSchemas(
  olderThanMs: number,
  options: SchemaOp = {},
): Promise<{ readonly dropped: readonly string[] }> {
  const pool = new Pool({ connectionString: resolveTestUrl(options.url) });
  const dropped: string[] = [];
  try {
    const { rows } = await pool.query<{ nspname: string; description: string | null }>(
      `SELECT n.nspname, d.description
       FROM pg_namespace n
       LEFT JOIN pg_description d
         ON d.objoid = n.oid
        AND d.classoid = 'pg_namespace'::regclass
       WHERE n.nspname LIKE 'e2e\\_%' ESCAPE '\\'`,
    );
    const now = Date.now();
    for (const row of rows) {
      const match = row.description?.match(/^created_at:(.+)$/);
      if (!match) continue;
      const createdAt = new Date(match[1]).getTime();
      if (!Number.isFinite(createdAt)) continue;
      if (now - createdAt < olderThanMs) continue;
      await pool.query(`DROP SCHEMA IF EXISTS "${row.nspname}" CASCADE`);
      dropped.push(row.nspname);
    }
  } finally {
    await pool.end();
  }
  return { dropped };
}
