// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRowPresence } from "@/hooks/use-row-presence";

type Item = { readonly id: string };

const getId = (item: Item): string => item.id;
const items = (...ids: readonly string[]): Item[] => ids.map((id) => ({ id }));
const ids = (list: readonly Item[]): string[] => list.map(getId);

/** Stub `window.matchMedia` (absent in jsdom) with a fixed `prefers-reduced-motion` result. */
function mockReducedMotion(matches: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function renderPresence(initial: readonly Item[]) {
  return renderHook(({ data }) => useRowPresence({ items: data, getId }), {
    initialProps: { data: initial },
  });
}

describe("useRowPresence", () => {
  beforeEach(() => {
    mockReducedMotion(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("entrada (enter)", () => {
    it("does not mark rows present at initial render as entering", () => {
      const { result } = renderPresence(items("a", "b"));

      expect(result.current.rowState("a")).toBe("idle");
      expect(result.current.rowState("b")).toBe("idle");
      expect(ids(result.current.renderItems)).toEqual(["a", "b"]);
    });

    it("marks a row added after mount as entering", () => {
      const { result, rerender } = renderPresence(items("a", "b"));

      rerender({ data: items("a", "b", "c") });

      expect(result.current.rowState("c")).toBe("entering");
      expect(result.current.rowState("a")).toBe("idle");
      expect(result.current.rowState("b")).toBe("idle");
    });

    it("clears the entering state to idle on onRowAnimationEnd", () => {
      const { result, rerender } = renderPresence(items("a"));

      rerender({ data: items("a", "b") });
      expect(result.current.rowState("b")).toBe("entering");

      act(() => result.current.onRowAnimationEnd("b"));

      expect(result.current.rowState("b")).toBe("idle");
    });

    it("animates a re-added row as a fresh entrance (desarquive)", () => {
      const { result, rerender } = renderPresence(items("a", "b"));

      // b leaves, animation completes, then b comes back with the same id.
      rerender({ data: items("a") });
      rerender({ data: items("a", "b") });

      expect(result.current.rowState("b")).toBe("entering");
    });
  });

  describe("reduced motion", () => {
    it("does not animate entrance under prefers-reduced-motion", () => {
      mockReducedMotion(true);
      const { result, rerender } = renderPresence(items("a"));

      rerender({ data: items("a", "b") });

      expect(result.current.rowState("b")).toBe("idle");
    });

    it("removes immediately without retaining under prefers-reduced-motion", () => {
      mockReducedMotion(true);
      const { result } = renderPresence(items("a", "b", "c"));
      const commit = vi.fn();

      act(() => result.current.remove("b", commit));

      expect(commit).toHaveBeenCalledTimes(1);
      expect(result.current.rowState("b")).toBe("idle");
    });
  });

  describe("saída (exit) — retain and defer", () => {
    it("retains the row as exiting and calls commit immediately", () => {
      const { result } = renderPresence(items("a", "b", "c"));
      const commit = vi.fn();

      act(() => result.current.remove("b", commit));

      expect(commit).toHaveBeenCalledTimes(1);
      expect(result.current.rowState("b")).toBe("exiting");
      expect(ids(result.current.renderItems)).toEqual(["a", "b", "c"]);
    });

    it("keeps the exiting row in render order after the source list drops it", () => {
      const { result, rerender } = renderPresence(items("a", "b", "c"));
      const commit = vi.fn();

      act(() => result.current.remove("b", commit));
      // Parent applies the optimistic removal: b leaves the source list.
      rerender({ data: items("a", "c") });

      expect(ids(result.current.renderItems)).toEqual(["a", "b", "c"]);
      expect(result.current.rowState("b")).toBe("exiting");
    });

    it("drops the exiting row from renderItems only on onRowAnimationEnd", () => {
      const { result, rerender } = renderPresence(items("a", "b", "c"));

      act(() => result.current.remove("b", vi.fn()));
      rerender({ data: items("a", "c") });
      expect(ids(result.current.renderItems)).toEqual(["a", "b", "c"]);

      act(() => result.current.onRowAnimationEnd("b"));

      expect(ids(result.current.renderItems)).toEqual(["a", "c"]);
      expect(result.current.rowState("b")).toBe("idle");
    });

    it("preserves position for multiple simultaneous removals (bulk-delete)", () => {
      const { result, rerender } = renderPresence(items("a", "b", "c", "d"));

      act(() => {
        result.current.remove("a", vi.fn());
        result.current.remove("c", vi.fn());
      });
      rerender({ data: items("b", "d") });

      expect(ids(result.current.renderItems)).toEqual(["a", "b", "c", "d"]);
      expect(result.current.rowState("a")).toBe("exiting");
      expect(result.current.rowState("c")).toBe("exiting");
    });
  });

  describe("immutability & handler stability", () => {
    it("returns a stable onRowAnimationEnd reference across renders", () => {
      const { result, rerender } = renderPresence(items("a"));
      const first = result.current.onRowAnimationEnd;

      rerender({ data: items("a") });

      expect(result.current.onRowAnimationEnd).toBe(first);
    });

    it("does not mutate the input items array", () => {
      const input = items("a", "b", "c");
      const snapshot = ids(input);
      const { result } = renderPresence(input);

      act(() => result.current.remove("b", vi.fn()));

      expect(ids(input)).toEqual(snapshot);
    });
  });
});
