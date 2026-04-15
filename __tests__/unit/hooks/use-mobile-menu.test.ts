// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMobileMenu } from "@/lib/hooks/use-mobile-menu";

describe("useMobileMenu", () => {
  describe("initial state", () => {
    it("starts closed", () => {
      const { result } = renderHook(() => useMobileMenu());

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe("toggle", () => {
    it("opens when toggled from closed", () => {
      const { result } = renderHook(() => useMobileMenu());

      act(() => result.current.toggle());

      expect(result.current.isOpen).toBe(true);
    });

    it("closes when toggled from open", () => {
      const { result } = renderHook(() => useMobileMenu());

      act(() => result.current.toggle());
      act(() => result.current.toggle());

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe("close", () => {
    it("closes the menu when open", () => {
      const { result } = renderHook(() => useMobileMenu());

      act(() => result.current.toggle());
      expect(result.current.isOpen).toBe(true);

      act(() => result.current.close());
      expect(result.current.isOpen).toBe(false);
    });

    it("remains closed when already closed", () => {
      const { result } = renderHook(() => useMobileMenu());

      act(() => result.current.close());

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe("Escape key handler", () => {
    it("closes the menu when Escape is pressed while open", () => {
      const { result } = renderHook(() => useMobileMenu());

      act(() => result.current.toggle());
      expect(result.current.isOpen).toBe(true);

      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });

      expect(result.current.isOpen).toBe(false);
    });

    it("does not react to Escape when menu is closed", () => {
      const { result } = renderHook(() => useMobileMenu());

      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });

      expect(result.current.isOpen).toBe(false);
    });

    it("ignores non-Escape keys when menu is open", () => {
      const { result } = renderHook(() => useMobileMenu());

      act(() => result.current.toggle());

      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      });

      expect(result.current.isOpen).toBe(true);
    });
  });

  describe("callback stability", () => {
    it("returns stable toggle and close references across renders", () => {
      const { result, rerender } = renderHook(() => useMobileMenu());

      const firstToggle = result.current.toggle;
      const firstClose = result.current.close;

      rerender();

      expect(result.current.toggle).toBe(firstToggle);
      expect(result.current.close).toBe(firstClose);
    });
  });
});
