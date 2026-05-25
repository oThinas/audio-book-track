import { describe, expect, it } from "vitest";

import { getCurrentUserId, requestContext } from "@/lib/api/request-context";

describe("requestContext — userId", () => {
  it("getCurrentUserId returns null outside of a request", () => {
    expect(getCurrentUserId()).toBeNull();
  });

  it("getCurrentUserId returns the stored userId inside requestContext.run", () => {
    requestContext.run({ requestId: "r1", userId: "user-42" }, () => {
      expect(getCurrentUserId()).toBe("user-42");
    });
  });

  it("getCurrentUserId returns null when the store has userId=null", () => {
    requestContext.run({ requestId: "r1", userId: null }, () => {
      expect(getCurrentUserId()).toBeNull();
    });
  });

  it("propagates userId across async boundaries", async () => {
    await requestContext.run({ requestId: "r1", userId: "user-deep" }, async () => {
      await Promise.resolve();
      expect(getCurrentUserId()).toBe("user-deep");
    });
  });

  it("isolates concurrent runs", async () => {
    const seen: Array<string | null> = [];
    await Promise.all([
      requestContext.run({ requestId: "a", userId: "ua" }, async () => {
        await Promise.resolve();
        seen.push(getCurrentUserId());
      }),
      requestContext.run({ requestId: "b", userId: "ub" }, async () => {
        await Promise.resolve();
        seen.push(getCurrentUserId());
      }),
    ]);
    expect(seen.sort()).toEqual(["ua", "ub"]);
  });
});
