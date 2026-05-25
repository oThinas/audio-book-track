import { afterEach, describe, expect, it, vi } from "vitest";

import { requestContext } from "@/lib/api/request-context";
import { serverLogger } from "@/lib/logger/server-logger";

describe("serverLogger — auto-inject from requestContext", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does NOT inject request_id/user_id when no context is active", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    serverLogger.info("plain");

    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload).toEqual({ level: "info", msg: "plain" });
    expect(payload.request_id).toBeUndefined();
    expect(payload.user_id).toBeUndefined();
  });

  it("auto-injects request_id and user_id when inside requestContext.run", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});

    requestContext.run({ requestId: "req_abc", userId: "user-7" }, () => {
      serverLogger.info("inside");
    });

    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload.request_id).toBe("req_abc");
    expect(payload.user_id).toBe("user-7");
    expect(payload.level).toBe("info");
    expect(payload.msg).toBe("inside");
  });

  it("uses null user_id when the store has userId=null", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});

    requestContext.run({ requestId: "req_abc", userId: null }, () => {
      serverLogger.info("anon");
    });

    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload.request_id).toBe("req_abc");
    expect(payload.user_id).toBeNull();
  });

  it("explicit context fields override auto-injected ones on conflict", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});

    requestContext.run({ requestId: "req_abc", userId: "user-7" }, () => {
      serverLogger.info("override", { request_id: "explicit-req", user_id: "explicit-user" });
    });

    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload.request_id).toBe("explicit-req");
    expect(payload.user_id).toBe("explicit-user");
  });

  it("works on all three levels (info, warn, error)", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    requestContext.run({ requestId: "req_x", userId: "ux" }, () => {
      serverLogger.info("i");
      serverLogger.warn("w");
      serverLogger.error("e");
    });

    expect(JSON.parse(infoSpy.mock.calls[0][0] as string).request_id).toBe("req_x");
    expect(JSON.parse(warnSpy.mock.calls[0][0] as string).request_id).toBe("req_x");
    expect(JSON.parse(errorSpy.mock.calls[0][0] as string).request_id).toBe("req_x");
  });
});
