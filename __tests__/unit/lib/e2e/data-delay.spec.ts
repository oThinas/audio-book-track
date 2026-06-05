import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyE2eDataDelay } from "@/lib/e2e/data-delay";

const cookieStore = { get: vi.fn() };

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(cookieStore),
}));

describe("applyE2eDataDelay", () => {
  const originalE2eTestMode = process.env.E2E_TEST_MODE;

  beforeEach(() => {
    vi.useFakeTimers();
    cookieStore.get.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.E2E_TEST_MODE = originalE2eTestMode;
  });

  it("resolves immediately when E2E_TEST_MODE is not enabled", async () => {
    process.env.E2E_TEST_MODE = undefined;
    cookieStore.get.mockReturnValue({ value: "1500" });

    await applyE2eDataDelay();

    expect(cookieStore.get).not.toHaveBeenCalled();
  });

  it("resolves immediately when the delay cookie is absent", async () => {
    process.env.E2E_TEST_MODE = "1";
    cookieStore.get.mockReturnValue(undefined);

    await applyE2eDataDelay();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("resolves immediately when the cookie value is not a positive number", async () => {
    process.env.E2E_TEST_MODE = "1";
    cookieStore.get.mockReturnValue({ value: "not-a-number" });

    await applyE2eDataDelay();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits for the cookie-provided delay when test mode is enabled", async () => {
    process.env.E2E_TEST_MODE = "1";
    cookieStore.get.mockReturnValue({ value: "1500" });

    let resolved = false;
    const pending = applyE2eDataDelay().then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(1499);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(resolved).toBe(true);
  });

  it("clamps the delay to the maximum allowed", async () => {
    process.env.E2E_TEST_MODE = "1";
    cookieStore.get.mockReturnValue({ value: "60000" });

    let resolved = false;
    const pending = applyE2eDataDelay().then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(5000);
    await pending;
    expect(resolved).toBe(true);
  });
});
