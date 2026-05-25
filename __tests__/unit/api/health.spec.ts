import { describe, expect, it, vi } from "vitest";
import { handleHealthCheck } from "@/app/api/health/route";
import type { HealthCheckResult } from "@/lib/db/health-check";

function createDeps(
  result: HealthCheckResult,
  overrides?: { appVersion?: string | undefined; appVersionUnset?: boolean },
) {
  return {
    createPing: vi.fn(() => vi.fn()),
    checkConnection: vi.fn().mockResolvedValue(result),
    uptimeSeconds: () => 42,
    appVersion: overrides?.appVersionUnset ? undefined : (overrides?.appVersion ?? "test-version"),
  };
}

describe("GET /api/health", () => {
  it("returns 200 with full ok payload when database is accessible", async () => {
    const deps = createDeps({ healthy: true, latencyMs: 3 });

    const response = await handleHealthCheck(deps);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "ok",
      uptime_seconds: 42,
      app_version: "test-version",
      checks: {
        database: { status: "ok", latency_ms: 3 },
      },
    });
  });

  it("returns 503 with degraded payload when database is inaccessible", async () => {
    const deps = createDeps({
      healthy: false,
      error: "Connection refused — check if PostgreSQL is running",
    });

    const response = await handleHealthCheck(deps);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.uptime_seconds).toBe(42);
    expect(body.app_version).toBe("test-version");
    expect(body.checks.database.status).toBe("down");
    expect(typeof body.checks.database.message).toBe("string");
  });

  it("includes Cache-Control: no-store on both ok and degraded responses", async () => {
    const okResponse = await handleHealthCheck(createDeps({ healthy: true }));
    const degradedResponse = await handleHealthCheck(createDeps({ healthy: false, error: "boom" }));

    expect(okResponse.headers.get("Cache-Control")).toBe("no-store");
    expect(degradedResponse.headers.get("Cache-Control")).toBe("no-store");
  });

  it("falls back to app_version='unknown' when not configured", async () => {
    const deps = createDeps({ healthy: true }, { appVersionUnset: true });

    const response = await handleHealthCheck(deps);
    const body = await response.json();

    expect(body.app_version).toBe("unknown");
  });

  it("does not expose sensitive information in degraded response", async () => {
    const deps = createDeps({
      healthy: false,
      error: "Connection refused — check if PostgreSQL is running",
    });

    const response = await handleHealthCheck(deps);
    const text = await response.text();

    expect(text).not.toContain("postgresql://");
    expect(text).not.toContain("password");
    expect(text).not.toContain("ECONNREFUSED");
    expect(text).not.toContain("stack");
    expect(text).not.toContain("localhost");
  });
});
