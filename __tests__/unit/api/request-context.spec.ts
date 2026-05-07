import { describe, expect, it } from "vitest";

import { getCurrentRequestId, requestContext } from "@/lib/api/request-context";

describe("requestContext (AsyncLocalStorage)", () => {
  it("getCurrentRequestId returns the stored value when run inside requestContext.run", () => {
    requestContext.run({ requestId: "abc" }, () => {
      expect(getCurrentRequestId()).toBe("abc");
    });
  });

  it("getCurrentRequestId returns null when no context is active", () => {
    expect(getCurrentRequestId()).toBeNull();
  });

  it("propagates the request id across async boundaries inside the same run", async () => {
    await requestContext.run({ requestId: "deep" }, async () => {
      await Promise.resolve();
      expect(getCurrentRequestId()).toBe("deep");
    });
  });

  it("isolates concurrent runs", async () => {
    const seen: Array<string | null> = [];
    await Promise.all([
      requestContext.run({ requestId: "a" }, async () => {
        await Promise.resolve();
        seen.push(getCurrentRequestId());
      }),
      requestContext.run({ requestId: "b" }, async () => {
        await Promise.resolve();
        seen.push(getCurrentRequestId());
      }),
    ]);
    expect(seen.sort()).toEqual(["a", "b"]);
  });
});
