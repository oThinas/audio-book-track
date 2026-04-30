// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoSavePreference } from "@/components/features/settings/hooks/use-auto-save-preference";

describe("useAutoSavePreference", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a stable save callback", () => {
    const { result, rerender } = renderHook(() => useAutoSavePreference());
    const firstSave = result.current.save;

    rerender();

    expect(result.current.save).toBe(firstSave);
  });

  it("debounces by 300ms before issuing PATCH /api/v1/user-preferences", async () => {
    const { result } = renderHook(() => useAutoSavePreference());

    act(() => {
      result.current.save({ primaryColor: "blue" });
    });

    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/user-preferences",
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryColor: "blue" }),
      }),
    );
  });

  it("collapses rapid calls into a single fetch with the last payload", async () => {
    const { result } = renderHook(() => useAutoSavePreference());

    act(() => {
      result.current.save({ primaryColor: "blue" });
    });
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.save({ primaryColor: "orange" });
    });
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.save({ primaryColor: "green" });
    });

    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/user-preferences",
      expect.objectContaining({
        body: JSON.stringify({ primaryColor: "green" }),
      }),
    );
  });
});
