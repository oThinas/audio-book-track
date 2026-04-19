import { describe, expect, it, vi } from "vitest";

import { checkDatabaseConnection, checkDatabaseHealth, type PingFn } from "@/lib/db/health-check";

describe("checkDatabaseHealth", () => {
  it("should return healthy when ping succeeds on first attempt", async () => {
    const ping: PingFn = vi.fn().mockResolvedValue(undefined);

    const result = await checkDatabaseHealth(ping, {
      maxRetries: 3,
      retryIntervalMs: 10,
      timeoutMs: 100,
    });

    expect(result).toEqual({ healthy: true });
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it("should retry and return healthy when ping succeeds on third attempt", async () => {
    const ping: PingFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValueOnce(undefined);

    const result = await checkDatabaseHealth(ping, {
      maxRetries: 3,
      retryIntervalMs: 10,
      timeoutMs: 100,
    });

    expect(result).toEqual({ healthy: true });
    expect(ping).toHaveBeenCalledTimes(3);
  });

  it("should return unhealthy after exhausting all retries", async () => {
    const ping: PingFn = vi.fn().mockRejectedValue(new Error("connection failed"));

    const result = await checkDatabaseHealth(ping, {
      maxRetries: 3,
      retryIntervalMs: 10,
      timeoutMs: 100,
    });

    expect(result).toEqual({
      healthy: false,
      error: expect.any(String),
    });
    expect(ping).toHaveBeenCalledTimes(3);
  });

  it("should return unhealthy on timeout when ping never resolves", async () => {
    const ping: PingFn = vi.fn().mockImplementation(() => new Promise(() => {}));

    const result = await checkDatabaseHealth(ping, {
      maxRetries: 1,
      retryIntervalMs: 10,
      timeoutMs: 50,
    });

    expect(result).toEqual({
      healthy: false,
      error: expect.stringContaining("Timeout"),
    });
  });

  it("should use default options when none provided", async () => {
    const ping: PingFn = vi.fn().mockResolvedValue(undefined);

    const result = await checkDatabaseHealth(ping);

    expect(result).toEqual({ healthy: true });
    expect(ping).toHaveBeenCalledTimes(1);
  });

  describe("error categorization", () => {
    const createErrorWithCode = (message: string, code: string): Error => {
      const error = new Error(message);
      (error as NodeJS.ErrnoException).code = code;
      return error;
    };

    it("should categorize ECONNREFUSED error", async () => {
      const error = createErrorWithCode("connect ECONNREFUSED 127.0.0.1:5432", "ECONNREFUSED");
      const ping: PingFn = vi.fn().mockRejectedValue(error);

      const result = await checkDatabaseHealth(ping, {
        maxRetries: 1,
        retryIntervalMs: 10,
        timeoutMs: 100,
      });

      expect(result.healthy).toBe(false);
      if (!result.healthy) {
        expect(result.error).toMatch(/connection refused/i);
      }
    });

    it("should categorize timeout error", async () => {
      const ping: PingFn = vi.fn().mockImplementation(() => new Promise(() => {}));

      const result = await checkDatabaseHealth(ping, {
        maxRetries: 1,
        retryIntervalMs: 10,
        timeoutMs: 50,
      });

      expect(result.healthy).toBe(false);
      if (!result.healthy) {
        expect(result.error).toMatch(/timeout/i);
      }
    });

    it("should categorize authentication error (28P01)", async () => {
      const error = createErrorWithCode("password authentication failed for user", "28P01");
      const ping: PingFn = vi.fn().mockRejectedValue(error);

      const result = await checkDatabaseHealth(ping, {
        maxRetries: 1,
        retryIntervalMs: 10,
        timeoutMs: 100,
      });

      expect(result.healthy).toBe(false);
      if (!result.healthy) {
        expect(result.error).toMatch(/authentication failed/i);
      }
    });

    it("should categorize generic errors safely", async () => {
      const error = new Error("something unexpected happened");
      const ping: PingFn = vi.fn().mockRejectedValue(error);

      const result = await checkDatabaseHealth(ping, {
        maxRetries: 1,
        retryIntervalMs: 10,
        timeoutMs: 100,
      });

      expect(result.healthy).toBe(false);
      if (!result.healthy) {
        expect(result.error).toMatch(/connection error/i);
      }
    });

    it("should never expose connection string in error messages", async () => {
      const error = new Error("connection to postgresql://user:s3cret@host:5432/mydb failed");
      const ping: PingFn = vi.fn().mockRejectedValue(error);

      const result = await checkDatabaseHealth(ping, {
        maxRetries: 1,
        retryIntervalMs: 10,
        timeoutMs: 100,
      });

      expect(result.healthy).toBe(false);
      if (!result.healthy) {
        expect(result.error).not.toContain("postgresql://");
        expect(result.error).not.toContain("s3cret");
        expect(result.error).not.toContain("user:");
      }
    });
  });
});

describe("checkDatabaseConnection", () => {
  it("should return healthy when ping succeeds", async () => {
    const ping: PingFn = vi.fn().mockResolvedValue(undefined);

    const result = await checkDatabaseConnection(ping, 100);

    expect(result).toEqual({ healthy: true });
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it("should return unhealthy when ping fails", async () => {
    const error = new Error("connection failed");
    (error as NodeJS.ErrnoException).code = "ECONNREFUSED";
    const ping: PingFn = vi.fn().mockRejectedValue(error);

    const result = await checkDatabaseConnection(ping, 100);

    expect(result).toEqual({
      healthy: false,
      error: expect.any(String),
    });
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it("should return unhealthy on timeout when ping never resolves", async () => {
    const ping: PingFn = vi.fn().mockImplementation(() => new Promise(() => {}));

    const result = await checkDatabaseConnection(ping, 50);

    expect(result).toEqual({
      healthy: false,
      error: expect.stringContaining("Timeout"),
    });
  });

  it("should not retry on failure (single attempt only)", async () => {
    const ping: PingFn = vi.fn().mockRejectedValue(new Error("fail"));

    await checkDatabaseConnection(ping, 100);

    expect(ping).toHaveBeenCalledTimes(1);
  });

  it("should use default timeout when none provided", async () => {
    const ping: PingFn = vi.fn().mockResolvedValue(undefined);

    const result = await checkDatabaseConnection(ping);

    expect(result).toEqual({ healthy: true });
  });
});
