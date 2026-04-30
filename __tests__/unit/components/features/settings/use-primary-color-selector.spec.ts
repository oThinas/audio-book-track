// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrimaryColorSelector } from "@/components/features/settings/hooks/use-primary-color-selector";

describe("usePrimaryColorSelector", () => {
  let setItem: ReturnType<typeof vi.fn>;

  beforeEach(() => {
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
    document.documentElement.removeAttribute("data-primary-color");
    vi.unstubAllGlobals();
  });

  it("starts with the initial value", () => {
    const { result } = renderHook(() =>
      usePrimaryColorSelector({ initialValue: "blue", save: vi.fn() }),
    );

    expect(result.current.selected).toBe("blue");
  });

  it("handleSelect updates selected, mutates the documentElement attribute and persists to localStorage", () => {
    const save = vi.fn();
    const { result } = renderHook(() => usePrimaryColorSelector({ initialValue: "blue", save }));

    act(() => {
      result.current.handleSelect("orange");
    });

    expect(result.current.selected).toBe("orange");
    expect(document.documentElement.getAttribute("data-primary-color")).toBe("orange");
    expect(setItem).toHaveBeenCalledWith("primary-color", "orange");
  });

  it("handleSelect calls save with the new primaryColor", () => {
    const save = vi.fn();
    const { result } = renderHook(() => usePrimaryColorSelector({ initialValue: "blue", save }));

    act(() => {
      result.current.handleSelect("green");
    });

    expect(save).toHaveBeenCalledWith({ primaryColor: "green" });
  });

  it("survives a localStorage write failure without throwing", () => {
    const save = vi.fn();
    setItem.mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    const { result } = renderHook(() => usePrimaryColorSelector({ initialValue: "blue", save }));

    expect(() => {
      act(() => {
        result.current.handleSelect("red");
      });
    }).not.toThrow();
    expect(result.current.selected).toBe("red");
    expect(save).toHaveBeenCalledWith({ primaryColor: "red" });
  });
});
