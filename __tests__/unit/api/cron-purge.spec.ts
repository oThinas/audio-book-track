import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleCronPurge } from "@/app/api/cron/purge-audit-log/route";

const VALID_SECRET = "abcdef0123456789abcdef0123456789abcdef0123456789";

vi.mock("@/lib/env", () => ({
  env: {
    CRON_SECRET: "abcdef0123456789abcdef0123456789abcdef0123456789",
    APP_VERSION: "test",
  },
}));

function makeRequest(token?: string): NextRequest {
  const headers = new Headers();
  if (token !== undefined) {
    headers.set("authorization", `Bearer ${token}`);
  }
  return new NextRequest("https://example.com/api/cron/purge-audit-log", {
    method: "POST",
    headers,
  });
}

type PurgeFn = (cutoff: Date) => Promise<number>;

describe("handleCronPurge", () => {
  let purgeMock: ReturnType<typeof vi.fn<PurgeFn>>;

  beforeEach(() => {
    purgeMock = vi.fn<PurgeFn>().mockResolvedValue(42);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 401 when authorization header is missing", async () => {
    const response = await handleCronPurge(makeRequest(), {
      purge: purgeMock,
      now: () => new Date(),
    });
    expect(response.status).toBe(401);
    expect(purgeMock).not.toHaveBeenCalled();
  });

  it("returns 401 when token does not match", async () => {
    const response = await handleCronPurge(makeRequest("wrong-token"), {
      purge: purgeMock,
      now: () => new Date(),
    });
    expect(response.status).toBe(401);
    expect(purgeMock).not.toHaveBeenCalled();
  });

  it("calls purge with cutoff = now - 90 days when authorized", async () => {
    const now = new Date("2026-05-24T00:00:00.000Z");
    const response = await handleCronPurge(makeRequest(VALID_SECRET), {
      purge: purgeMock,
      now: () => now,
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.purged).toBe(42);
    expect(typeof body.cutoff).toBe("string");
    expect(typeof body.duration_ms).toBe("number");

    expect(purgeMock).toHaveBeenCalledTimes(1);
    const cutoff = purgeMock.mock.calls[0][0] as Date;
    const expectedCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    expect(cutoff.toISOString()).toBe(expectedCutoff.toISOString());
  });

  it("returns purged=0 when no rows are old enough (idempotent)", async () => {
    purgeMock.mockResolvedValueOnce(0);
    const response = await handleCronPurge(makeRequest(VALID_SECRET), {
      purge: purgeMock,
      now: () => new Date(),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.purged).toBe(0);
  });
});
