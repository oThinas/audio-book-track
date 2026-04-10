import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import type { HealthCheckResult } from "@/lib/db/health-check";

vi.mock("@/lib/db/ping", () => ({
  createDatabasePing: vi.fn(() => vi.fn()),
}));

vi.mock("@/lib/db/health-check", () => ({
  checkDatabaseHealth: vi.fn(),
}));

describe("instrumentation register()", () => {
  let checkDatabaseHealth: Mock;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();

    const healthModule = await import("@/lib/db/health-check");
    checkDatabaseHealth = healthModule.checkDatabaseHealth as Mock;

    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should log success when database is healthy", async () => {
    const healthy: HealthCheckResult = { healthy: true };
    checkDatabaseHealth.mockResolvedValue(healthy);

    const { register } = await import("@/instrumentation");
    await register();

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining("[health-check] Database connection verified successfully"),
    );
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("should log error and call process.exit(1) when database is unhealthy", async () => {
    const unhealthy: HealthCheckResult = {
      healthy: false,
      error: "Connection refused — check if PostgreSQL is running",
    };
    checkDatabaseHealth.mockResolvedValue(unhealthy);

    const { register } = await import("@/instrumentation");
    await register();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[health-check\] Database health check failed after \d+ attempts:/),
    );
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Connection refused"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
