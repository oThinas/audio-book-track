import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { requestContext } from "@/lib/api/request-context";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import type { ServerLogger } from "@/lib/logger/server-logger";

function createLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } satisfies ServerLogger;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("withRequestLogging", () => {
  it("emits a single info log with method, path, status and duration on success", async () => {
    const logger = createLogger();
    const request = new Request("https://example.com/api/v1/books?limit=20", { method: "GET" });
    const handler = vi.fn(async () => NextResponse.json({ ok: true }, { status: 200 }));

    const response = await requestContext.run({ requestId: "req_1", userId: "u-1" }, () =>
      withRequestLogging(handler, { logger })(request),
    );

    expect(response.status).toBe(200);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();

    const payload = logger.info.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.method).toBe("GET");
    expect(payload.path).toBe("/api/v1/books");
    expect(payload.status).toBe(200);
    expect(typeof payload.duration_ms).toBe("number");
    expect(payload.duration_ms).toBeGreaterThanOrEqual(0);
    expect(payload.slow).toBe(false);
  });

  it("emits an error log when the handler throws and re-throws the error", async () => {
    const logger = createLogger();
    const request = new Request("https://example.com/api/v1/boom", { method: "POST" });
    const handler = vi.fn(async () => {
      throw new Error("kaboom");
    });

    await expect(
      requestContext.run({ requestId: "req_2", userId: null }, () =>
        withRequestLogging(handler, { logger })(request),
      ),
    ).rejects.toThrow("kaboom");

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();

    const payload = logger.error.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.method).toBe("POST");
    expect(payload.path).toBe("/api/v1/boom");
    expect(payload.status).toBe(500);
    expect(typeof payload.duration_ms).toBe("number");
  });

  it("marks log as slow when duration exceeds threshold", async () => {
    const logger = createLogger();
    const request = new Request("https://example.com/api/v1/slow", { method: "GET" });

    let now = 1000;
    const nowFn = vi.fn(() => now);
    const handler = vi.fn(async () => {
      now += 3500;
      return NextResponse.json({ ok: true });
    });

    await withRequestLogging(handler, { logger, slowThresholdMs: 3000, now: nowFn })(request);

    const payload = logger.info.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.slow).toBe(true);
    expect(payload.duration_ms).toBeGreaterThanOrEqual(3500);
  });

  it("does not include body, cookies, authorization, IP or user-agent in the log", async () => {
    const logger = createLogger();
    const request = new Request("https://example.com/api/v1/secrets", {
      method: "POST",
      headers: {
        cookie: "session=abc",
        authorization: "Bearer secret-token",
        "user-agent": "Mozilla/5.0",
        "x-forwarded-for": "203.0.113.42",
      },
      body: JSON.stringify({ password: "p4ssw0rd" }),
    });
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));

    await withRequestLogging(handler, { logger })(request);

    const payload = logger.info.mock.calls[0][1] as Record<string, unknown>;
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("session=abc");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("Mozilla");
    expect(serialized).not.toContain("203.0.113.42");
    expect(serialized).not.toContain("p4ssw0rd");
    expect(serialized).not.toContain("password");
    expect(payload.cookie).toBeUndefined();
    expect(payload.authorization).toBeUndefined();
    expect(payload.body).toBeUndefined();
  });

  it("logs duration even when handler returns a non-2xx status", async () => {
    const logger = createLogger();
    const request = new Request("https://example.com/api/v1/forbidden");
    const handler = vi.fn(async () => NextResponse.json({ error: "x" }, { status: 403 }));

    await withRequestLogging(handler, { logger })(request);

    const payload = logger.info.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.status).toBe(403);
  });
});
