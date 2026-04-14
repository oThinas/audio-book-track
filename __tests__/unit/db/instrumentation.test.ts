import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HealthCheckResult } from "@/lib/db/health-check";
import { runStartupHealthCheck } from "@/lib/db/startup-health-check";

function createDeps(result: HealthCheckResult) {
  return {
    createPing: vi.fn(() => vi.fn()),
    checkHealth: vi.fn().mockResolvedValue(result),
  };
}

describe("runStartupHealthCheck()", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should log success when database is healthy", async () => {
    const deps = createDeps({ healthy: true });

    await runStartupHealthCheck(deps);

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining("[health-check] Database connection verified successfully"),
    );
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("should log error and call process.exit(1) when database is unhealthy", async () => {
    const deps = createDeps({
      healthy: false,
      error: "Connection refused — check if PostgreSQL is running",
    });

    await runStartupHealthCheck(deps);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[health-check\] Database health check failed after \d+ attempts:/),
    );
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Connection refused"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
