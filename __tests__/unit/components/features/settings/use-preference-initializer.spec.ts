// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferenceInitializer } from "@/components/features/settings/hooks/use-preference-initializer";

describe("usePreferenceInitializer", () => {
  let setItem: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.documentElement.style.fontSize = "";
    document.documentElement.removeAttribute("data-primary-color");
    // Vitest 4 + jsdom ships a stripped-down `localStorage` (null prototype, no
    // methods). Stub a working shim so the hook's `localStorage.setItem(...)`
    // call can be observed.
    setItem = vi.fn();
    vi.stubGlobal("localStorage", {
      setItem,
      getItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    });
  });

  afterEach(() => {
    document.documentElement.style.fontSize = "";
    document.documentElement.removeAttribute("data-primary-color");
    vi.unstubAllGlobals();
  });

  it("applies the matching px value for each fontSize on mount", () => {
    renderHook(() => usePreferenceInitializer({ fontSize: "small", primaryColor: "blue" }));
    expect(document.documentElement.style.fontSize).toBe("14px");

    document.documentElement.style.fontSize = "";
    renderHook(() => usePreferenceInitializer({ fontSize: "medium", primaryColor: "blue" }));
    expect(document.documentElement.style.fontSize).toBe("16px");

    document.documentElement.style.fontSize = "";
    renderHook(() => usePreferenceInitializer({ fontSize: "large", primaryColor: "blue" }));
    expect(document.documentElement.style.fontSize).toBe("18px");
  });

  it("sets data-primary-color attribute on mount", () => {
    renderHook(() => usePreferenceInitializer({ fontSize: "medium", primaryColor: "orange" }));

    expect(document.documentElement.getAttribute("data-primary-color")).toBe("orange");
  });

  it("persists primaryColor to localStorage on mount", () => {
    renderHook(() => usePreferenceInitializer({ fontSize: "medium", primaryColor: "green" }));

    expect(setItem).toHaveBeenCalledWith("primary-color", "green");
  });

  it("survives a localStorage write failure without throwing", () => {
    setItem.mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    expect(() => {
      renderHook(() => usePreferenceInitializer({ fontSize: "medium", primaryColor: "red" }));
    }).not.toThrow();
    expect(document.documentElement.getAttribute("data-primary-color")).toBe("red");
  });

  it("re-applies the effect when props change", () => {
    const { rerender } = renderHook(
      ({
        fontSize,
        primaryColor,
      }: {
        fontSize: "small" | "medium" | "large";
        primaryColor: "blue" | "orange" | "green" | "red" | "amber";
      }) => usePreferenceInitializer({ fontSize, primaryColor }),
      {
        initialProps: { fontSize: "small", primaryColor: "blue" } as {
          fontSize: "small" | "medium" | "large";
          primaryColor: "blue" | "orange" | "green" | "red" | "amber";
        },
      },
    );

    expect(document.documentElement.style.fontSize).toBe("14px");
    expect(document.documentElement.getAttribute("data-primary-color")).toBe("blue");

    rerender({ fontSize: "large", primaryColor: "amber" });

    expect(document.documentElement.style.fontSize).toBe("18px");
    expect(document.documentElement.getAttribute("data-primary-color")).toBe("amber");
    expect(setItem).toHaveBeenLastCalledWith("primary-color", "amber");
  });
});
