// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDeleteChapter } from "@/components/features/chapters/hooks/use-delete-chapter";

vi.mock("@/lib/api/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@/lib/api/api-fetch");

describe("useDeleteChapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("openDelete/cancelDelete toggles deleteOpen", () => {
    const { result } = renderHook(() => useDeleteChapter({ chapterId: "c-1", onDeleted: vi.fn() }));
    expect(result.current.deleteOpen).toBe(false);

    act(() => result.current.openDelete());
    expect(result.current.deleteOpen).toBe(true);

    act(() => result.current.cancelDelete());
    expect(result.current.deleteOpen).toBe(false);
  });

  it("on success without X-Book-Deleted header, calls onDeleted with bookDeleted=false", async () => {
    const onDeleted = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: true, data: null, headers: new Headers() });

    const { result } = renderHook(() => useDeleteChapter({ chapterId: "c-1", onDeleted }));
    act(() => result.current.openDelete());
    await act(async () => {
      await result.current.handleDelete();
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/chapters/c-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(onDeleted).toHaveBeenCalledWith("c-1", false);
    expect(result.current.deleteOpen).toBe(false);
  });

  it("on success with X-Book-Deleted header, propagates bookDeleted=true", async () => {
    const onDeleted = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      data: null,
      headers: new Headers({ "X-Book-Deleted": "true" }),
    });

    const { result } = renderHook(() => useDeleteChapter({ chapterId: "c-1", onDeleted }));
    await act(async () => {
      await result.current.handleDelete();
    });

    expect(onDeleted).toHaveBeenCalledWith("c-1", true);
  });

  it("on api-error, does not call onDeleted (toast handled by wrapper)", async () => {
    const onDeleted = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "CHAPTER_PAID_LOCKED",
    });

    const { result } = renderHook(() => useDeleteChapter({ chapterId: "c-1", onDeleted }));
    await act(async () => {
      await result.current.handleDelete();
    });

    expect(onDeleted).not.toHaveBeenCalled();
  });
});
