import { getTestDb } from "@tests/helpers/db";
import { sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", async () => {
  const actual = await vi.importActual<typeof import("@/lib/env")>("@/lib/env");
  return {
    ...actual,
    env: {
      ...actual.env,
      CRON_SECRET: "abcdef0123456789abcdef0123456789abcdef0123456789",
    },
  };
});

import { handleCronPurge } from "@/app/api/cron/purge-audit-log/route";
import { AUDIT_ACTIONS } from "@/lib/audit/audit-actions";
import type { AuditPayload } from "@/lib/audit/audit-payload";
import { DrizzleAuditLogRepository } from "@/lib/repositories/drizzle/drizzle-audit-log-repository";

const VALID_SECRET = "abcdef0123456789abcdef0123456789abcdef0123456789";

function makeRequest(token?: string): NextRequest {
  const headers = new Headers();
  if (token !== undefined) headers.set("authorization", `Bearer ${token}`);
  return new NextRequest("https://example.com/api/cron/purge-audit-log", {
    method: "POST",
    headers,
  });
}

function buildDeps() {
  const db = getTestDb();
  const repo = new DrizzleAuditLogRepository(db);
  return {
    purge: (cutoff: Date) => repo.deleteOlderThan(cutoff),
    now: () => new Date("2026-05-25T00:00:00.000Z"),
    repo,
    db,
  };
}

async function seedAuditRow(
  db: ReturnType<typeof getTestDb>,
  overrides: Partial<AuditPayload> & { createdAtSql?: string } = {},
): Promise<string> {
  const requestId = overrides.requestId ?? `req-${crypto.randomUUID()}`;
  const action = overrides.action ?? AUDIT_ACTIONS.STUDIO_CREATE;
  const entityType = overrides.entityType ?? "studio";
  const entityId = overrides.entityId ?? `studio-${crypto.randomUUID()}`;
  const userId = overrides.userId ?? "user-1";
  const createdAtSql = overrides.createdAtSql ?? "now()";

  const id = crypto.randomUUID();
  await db.execute(
    sql.raw(
      `INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, request_id, created_at)
       VALUES ('${id}', '${userId}', '${action}', '${entityType}', '${entityId}', '${requestId}', ${createdAtSql})`,
    ),
  );
  return requestId;
}

describe("POST /api/cron/purge-audit-log (integration)", () => {
  it("returns 401 when authorization header is missing", async () => {
    const deps = buildDeps();
    const response = await handleCronPurge(makeRequest(), deps);
    expect(response.status).toBe(401);
  });

  it("returns 401 when bearer token does not match CRON_SECRET", async () => {
    const deps = buildDeps();
    const response = await handleCronPurge(makeRequest("wrong-token"), deps);
    expect(response.status).toBe(401);
  });

  it("purges rows older than 90 days and is idempotent on a second run", async () => {
    const deps = buildDeps();
    const oldRequestIds: string[] = [];
    const freshRequestIds: string[] = [];

    for (let i = 0; i < 5; i += 1) {
      oldRequestIds.push(
        await seedAuditRow(deps.db, {
          requestId: `req-old-${i}-${crypto.randomUUID()}`,
          createdAtSql: "now() - interval '100 days'",
        }),
      );
    }
    for (let i = 0; i < 3; i += 1) {
      freshRequestIds.push(
        await seedAuditRow(deps.db, {
          requestId: `req-fresh-${i}-${crypto.randomUUID()}`,
        }),
      );
    }

    const firstResponse = await handleCronPurge(makeRequest(VALID_SECRET), deps);
    expect(firstResponse.status).toBe(200);
    const firstBody = await firstResponse.json();
    expect(firstBody.purged).toBe(5);
    expect(typeof firstBody.cutoff).toBe("string");
    expect(typeof firstBody.duration_ms).toBe("number");

    for (const requestId of oldRequestIds) {
      const rows = await deps.repo.findByRequestId(requestId);
      expect(rows).toHaveLength(0);
    }
    for (const requestId of freshRequestIds) {
      const rows = await deps.repo.findByRequestId(requestId);
      expect(rows).toHaveLength(1);
    }

    const secondResponse = await handleCronPurge(makeRequest(VALID_SECRET), deps);
    expect(secondResponse.status).toBe(200);
    const secondBody = await secondResponse.json();
    expect(secondBody.purged).toBe(0);

    for (const requestId of freshRequestIds) {
      const rows = await deps.repo.findByRequestId(requestId);
      expect(rows).toHaveLength(1);
    }
  });

  it("returns purged=0 when audit_log has only fresh rows", async () => {
    const deps = buildDeps();
    await seedAuditRow(deps.db);
    await seedAuditRow(deps.db);

    const response = await handleCronPurge(makeRequest(VALID_SECRET), deps);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.purged).toBe(0);
  });
});
