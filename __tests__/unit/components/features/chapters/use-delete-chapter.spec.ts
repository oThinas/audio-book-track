// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { emptyResponse, jsonResponse } from "@tests/helpers/fetch-response";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDeleteChapter } from "@/components/features/chapters/hooks/use-delete-chapter";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

describe("useDeleteChapter", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("openDelete/cancelDelete toggles deleteOpen", () => {
    const { result } = renderHook(() => useDeleteChapter({ chapterId: "c-1", onDeleted: vi.fn() }));
    expect(result.current.deleteOpen).toBe(false);

    act(() => result.current.openDelete());
    expect(result.current.deleteOpen).toBe(true);

    act(() => result.current.cancelDelete());
    expect(result.current.deleteOpen).toBe(false);
  });

  it("on 204 success without X-Book-Deleted header, calls onDeleted with bookDeleted=false", async () => {
    const onDeleted = vi.fn();
    fetchMock.mockResolvedValueOnce(emptyResponse(204));

    const { result } = renderHook(() => useDeleteChapter({ chapterId: "c-1", onDeleted }));
    act(() => result.current.openDelete());
    await act(async () => {
      await result.current.handleDelete();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/chapters/c-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(onDeleted).toHaveBeenCalledWith("c-1", false);
    expect(result.current.deleteOpen).toBe(false);
  });

  it("on 204 with X-Book-Deleted header, propagates bookDeleted=true", async () => {
    const onDeleted = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 204, headers: { "X-Book-Deleted": "true" } }),
    );

    const { result } = renderHook(() => useDeleteChapter({ chapterId: "c-1", onDeleted }));
    await act(async () => {
      await result.current.handleDelete();
    });

    expect(onDeleted).toHaveBeenCalledWith("c-1", true);
  });

  it("on non-204 with error body, fires server message via toast.error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: { code: "X", message: "Cannot delete because reasons." } }),
    );

    const { result } = renderHook(() => useDeleteChapter({ chapterId: "c-1", onDeleted: vi.fn() }));
    await act(async () => {
      await result.current.handleDelete();
    });

    expect(toast.error).toHaveBeenCalledWith("Cannot delete because reasons.");
  });

  it("on non-204 without parseable body, fires generic toast.error", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(500));

    const { result } = renderHook(() => useDeleteChapter({ chapterId: "c-1", onDeleted: vi.fn() }));
    await act(async () => {
      await result.current.handleDelete();
    });

    expect(toast.error).toHaveBeenCalledWith("Erro ao excluir capítulo.");
  });
});
