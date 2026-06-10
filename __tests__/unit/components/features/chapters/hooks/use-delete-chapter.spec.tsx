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

  it("calls onDeleted and onVersionChange with the X-Chapters-Version header", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      data: null,
      headers: new Headers({ "X-Chapters-Version": "5" }),
    });
    const onDeleted = vi.fn();
    const onVersionChange = vi.fn();
    const { result } = renderHook(() =>
      useDeleteChapter({ chapterId: "c-1", onDeleted, onVersionChange }),
    );

    await act(async () => {
      await result.current.handleDelete();
    });

    expect(onDeleted).toHaveBeenCalledWith("c-1", false);
    expect(onVersionChange).toHaveBeenCalledWith(5);
  });

  it("does not call onVersionChange when the book was deleted (no version header)", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      data: null,
      headers: new Headers({ "X-Book-Deleted": "true" }),
    });
    const onDeleted = vi.fn();
    const onVersionChange = vi.fn();
    const { result } = renderHook(() =>
      useDeleteChapter({ chapterId: "c-1", onDeleted, onVersionChange }),
    );

    await act(async () => {
      await result.current.handleDelete();
    });

    expect(onDeleted).toHaveBeenCalledWith("c-1", true);
    expect(onVersionChange).not.toHaveBeenCalled();
  });

  it("does not call any callback on error", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "CHAPTER_PAID_LOCKED",
    });
    const onDeleted = vi.fn();
    const onVersionChange = vi.fn();
    const { result } = renderHook(() =>
      useDeleteChapter({ chapterId: "c-1", onDeleted, onVersionChange }),
    );

    await act(async () => {
      await result.current.handleDelete();
    });

    expect(onDeleted).not.toHaveBeenCalled();
    expect(onVersionChange).not.toHaveBeenCalled();
  });
});
