// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePaidReversion } from "@/components/features/chapters/hooks/use-paid-reversion";

describe("usePaidReversion", () => {
  it("starts with no pending value", () => {
    const { result } = renderHook(() => usePaidReversion<{ x: number }>());
    expect(result.current.pending).toBeNull();
  });

  it("request() stores the pending value", () => {
    const { result } = renderHook(() => usePaidReversion<{ x: number }>());
    act(() => result.current.request({ x: 1 }));
    expect(result.current.pending).toEqual({ x: 1 });
  });

  it("cancel() clears the pending value", () => {
    const { result } = renderHook(() => usePaidReversion<{ x: number }>());
    act(() => result.current.request({ x: 1 }));
    act(() => result.current.cancel());
    expect(result.current.pending).toBeNull();
  });

  it("take() returns the current value AND clears it (single-shot)", () => {
    const { result } = renderHook(() => usePaidReversion<{ x: number }>());
    act(() => result.current.request({ x: 42 }));

    let taken!: { x: number } | null;
    act(() => {
      taken = result.current.take();
    });

    expect(taken).toEqual({ x: 42 });
    expect(result.current.pending).toBeNull();
  });
});
