import { afterEach, describe, expect, it, vi } from "vitest";

import { serverLogger } from "@/lib/logger/server-logger";

describe("serverLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("error() emits structured JSON via console.error with level/msg/ctx", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    serverLogger.error("boom", { requestId: "abc", attempt: 2 });
    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload).toEqual({ level: "error", msg: "boom", requestId: "abc", attempt: 2 });
  });

  it("warn() emits structured JSON via console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    serverLogger.warn("careful", { reason: "rate-limit" });
    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload).toEqual({ level: "warn", msg: "careful", reason: "rate-limit" });
  });

  it("info() emits structured JSON via console.info", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    serverLogger.info("hello", { userId: 7 });
    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload).toEqual({ level: "info", msg: "hello", userId: 7 });
  });

  it("methods accept no context and still emit valid JSON", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    serverLogger.info("plain");
    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload).toEqual({ level: "info", msg: "plain" });
  });
});
