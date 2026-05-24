import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createAuditService } from "@/lib/factories/audit";
import { DrizzleAuditLogRepository } from "@/lib/repositories/drizzle/drizzle-audit-log-repository";

const PURGE_OLDER_THAN_DAYS = 90;

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  try {
    const { timingSafeEqual: nodeTimingSafeEqual } =
      require("node:crypto") as typeof import("node:crypto");
    return nodeTimingSafeEqual(bufA, bufB);
  } catch {
    return a === b;
  }
}

function isAuthorized(request: NextRequest): boolean {
  const expected = env.CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  const token = header.slice(prefix.length);
  return timingSafeEqual(token, expected);
}

export interface PurgeAuditLogDeps {
  readonly purge: (cutoff: Date) => Promise<number>;
  readonly now: () => Date;
}

const defaultDeps: PurgeAuditLogDeps = {
  purge: async (cutoff) => {
    const repo = new DrizzleAuditLogRepository(db);
    return repo.deleteOlderThan(cutoff);
  },
  now: () => new Date(),
};

export async function handleCronPurge(
  request: NextRequest,
  deps: PurgeAuditLogDeps = defaultDeps,
): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Acesso não autorizado." } },
      { status: 401 },
    );
  }

  const start = performance.now();
  const cutoff = new Date(deps.now().getTime() - PURGE_OLDER_THAN_DAYS * 24 * 60 * 60 * 1000);
  const purged = await deps.purge(cutoff);
  const durationMs = Math.max(0, Math.round(performance.now() - start));

  return NextResponse.json({
    purged,
    cutoff: cutoff.toISOString(),
    duration_ms: durationMs,
  });
}

// Mantém o createAuditService import vivo para garantir que o singleton seja
// inicializado quando algum entry point importar esta rota.
void createAuditService;

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleCronPurge(request);
}
