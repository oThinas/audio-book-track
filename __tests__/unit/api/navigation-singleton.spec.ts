// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  navigateToLogin,
  registerNavigator,
  unregisterNavigator,
} from "@/components/features/auth/navigation-singleton";

describe("navigation singleton", () => {
  afterEach(() => {
    unregisterNavigator();
    vi.restoreAllMocks();
  });

  it("registerNavigator stores the function and navigateToLogin invokes it with /login", () => {
    const navigate = vi.fn<(path: string) => void>();
    registerNavigator(navigate);

    navigateToLogin();

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/login");
  });

  it("falls back to window.location.replace when no navigator is registered", () => {
    const replace = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, replace },
      writable: true,
      configurable: true,
    });

    try {
      navigateToLogin();
      expect(replace).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledWith("/login");
    } finally {
      Object.defineProperty(window, "location", {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    }
  });

  it("unregisterNavigator clears the registration so subsequent calls fall back", () => {
    const navigate = vi.fn();
    registerNavigator(navigate);
    unregisterNavigator();

    const replace = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, replace },
      writable: true,
      configurable: true,
    });

    try {
      navigateToLogin();
      expect(navigate).not.toHaveBeenCalled();
      expect(replace).toHaveBeenCalledWith("/login");
    } finally {
      Object.defineProperty(window, "location", {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    }
  });
});
