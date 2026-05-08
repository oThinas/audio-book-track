// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoSavePreference } from "@/components/features/settings/hooks/use-auto-save-preference";

vi.mock("@/lib/api/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@/lib/api/api-fetch");

describe("useAutoSavePreference", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockResolvedValue({ ok: true, data: null, headers: new Headers() });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
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

    expect(apiFetch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/user-preferences",
      expect.objectContaining({ method: "PATCH", body: { primaryColor: "blue" } }),
    );
  });

  it("collapses rapid calls into a single apiFetch with the last payload", async () => {
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

    expect(apiFetch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/user-preferences",
      expect.objectContaining({ body: { primaryColor: "green" } }),
    );
  });
});
