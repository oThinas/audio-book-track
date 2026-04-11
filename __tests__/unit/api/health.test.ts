import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import type { HealthCheckResult } from "@/lib/db/health-check";

vi.mock("@/lib/db/ping", () => ({
  createDatabasePing: vi.fn(() => vi.fn()),
}));

vi.mock("@/lib/db/health-check", () => ({
  checkDatabaseConnection: vi.fn(),
}));

import { GET } from "@/app/api/health/route";
import { checkDatabaseConnection } from "@/lib/db/health-check";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 200 with healthy status when database is accessible", async () => {
    const healthy: HealthCheckResult = { healthy: true };
    (checkDatabaseConnection as Mock).mockResolvedValue(healthy);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "healthy",
      checks: { database: "healthy" },
    });
  });

  it("should return 503 with unhealthy status when database is inaccessible", async () => {
    const unhealthy: HealthCheckResult = {
      healthy: false,
      error: "Connection refused — check if PostgreSQL is running",
    };
    (checkDatabaseConnection as Mock).mockResolvedValue(unhealthy);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      status: "unhealthy",
      checks: { database: "unhealthy" },
    });
  });

  it("should include Cache-Control: no-store header", async () => {
    const healthy: HealthCheckResult = { healthy: true };
    (checkDatabaseConnection as Mock).mockResolvedValue(healthy);

    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("should not expose sensitive information in the response", async () => {
    const unhealthy: HealthCheckResult = {
      healthy: false,
      error: "Connection refused — check if PostgreSQL is running",
    };
    (checkDatabaseConnection as Mock).mockResolvedValue(unhealthy);

    const response = await GET();
    const text = await response.text();

    expect(text).not.toContain("postgresql://");
    expect(text).not.toContain("password");
    expect(text).not.toContain("ECONNREFUSED");
    expect(text).not.toContain("stack");
    expect(text).not.toContain("localhost");
  });
});
