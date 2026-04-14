import { describe, expect, it, vi } from "vitest";
import { handleHealthCheck } from "@/app/api/health/route";
import type { HealthCheckResult } from "@/lib/db/health-check";

function createDeps(result: HealthCheckResult) {
  return {
    createPing: vi.fn(() => vi.fn()),
    checkConnection: vi.fn().mockResolvedValue(result),
  };
}

describe("GET /api/health", () => {
  it("should return 200 with healthy status when database is accessible", async () => {
    const deps = createDeps({ healthy: true });

    const response = await handleHealthCheck(deps);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "healthy",
      checks: { database: "healthy" },
    });
  });

  it("should return 503 with unhealthy status when database is inaccessible", async () => {
    const deps = createDeps({
      healthy: false,
      error: "Connection refused — check if PostgreSQL is running",
    });

    const response = await handleHealthCheck(deps);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      status: "unhealthy",
      checks: { database: "unhealthy" },
    });
  });

  it("should include Cache-Control: no-store header", async () => {
    const deps = createDeps({ healthy: true });

    const response = await handleHealthCheck(deps);

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("should not expose sensitive information in the response", async () => {
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
