// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { emptyResponse, jsonResponse } from "@tests/helpers/fetch-response";
import { buildChapterRowData } from "@tests/helpers/seed";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookDetailData } from "@/components/features/books/book-detail-client";
import { useBookDetail } from "@/components/features/books/hooks/use-book-detail";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const BASE_BOOK: BookDetailData = {
  id: "b-1",
  title: "Test",
  studio: { id: "s-1", name: "Studio" },
  pricePerHourCents: 8000,
  pdfUrl: null,
  status: "pending",
  totalChapters: 0,
  completedChapters: 0,
  totalEarningsCents: 0,
  chapters: [
    buildChapterRowData({ id: "c-1", number: 1, status: "pending" }),
    buildChapterRowData({ id: "c-2", number: 2, status: "paid" }),
  ],
};

describe("useBookDetail", () => {
  let routerPush: ReturnType<typeof vi.fn>;
  let routerRefresh: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    routerPush = vi.fn();
    routerRefresh = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: routerPush,
      replace: vi.fn(),
      refresh: routerRefresh,
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    } as unknown as ReturnType<typeof useRouter>);
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("computes nonPaidChapters and paidCount correctly", () => {
    const { result } = renderHook(() => useBookDetail(BASE_BOOK));
    expect(result.current.nonPaidChapters.map((c) => c.id)).toEqual(["c-1"]);
    expect(result.current.paidCount).toBe(1);
  });

  it("handleChapterDeleted with bookDeleted=true redirects to /books", () => {
    const { result } = renderHook(() => useBookDetail(BASE_BOOK));
    act(() => result.current.handleChapterDeleted("c-1", true));
    expect(routerPush).toHaveBeenCalledWith("/books");
  });

  it("handleChapterDeleted with bookDeleted=false removes chapter from state", () => {
    const { result } = renderHook(() => useBookDetail(BASE_BOOK));
    act(() => result.current.handleChapterDeleted("c-1", false));
    expect(result.current.state.chapters.map((c) => c.id)).toEqual(["c-2"]);
  });

  it("handlePdfUrlChange updates state and calls router.refresh", () => {
    const { result } = renderHook(() => useBookDetail(BASE_BOOK));
    act(() => result.current.handlePdfUrlChange("https://x.com/a.pdf"));
    expect(result.current.state.pdfUrl).toBe("https://x.com/a.pdf");
    expect(routerRefresh).toHaveBeenCalled();
  });

  it("enterSelectionMode/exitSelectionMode toggle isSelectionMode and reset selection", () => {
    const { result } = renderHook(() => useBookDetail(BASE_BOOK));
    act(() => result.current.enterSelectionMode());
    expect(result.current.isSelectionMode).toBe(true);

    act(() => result.current.handleToggleSelected("c-1", true));
    expect(result.current.selectedIds.has("c-1")).toBe(true);

    act(() => result.current.exitSelectionMode());
    expect(result.current.isSelectionMode).toBe(false);
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("handleToggleSelectAll(true) selects all non-paid chapters", () => {
    const { result } = renderHook(() => useBookDetail(BASE_BOOK));
    act(() => result.current.handleToggleSelectAll(true));
    expect(Array.from(result.current.selectedIds)).toEqual(["c-1"]);
  });

  it("willDeleteBook is true when only non-paid chapters are selected and there are no paid", () => {
    const all_non_paid: BookDetailData = {
      ...BASE_BOOK,
      chapters: [
        buildChapterRowData({ id: "c-1", number: 1, status: "pending" }),
        buildChapterRowData({ id: "c-2", number: 2, status: "pending" }),
      ],
    };
    const { result } = renderHook(() => useBookDetail(all_non_paid));
    act(() => result.current.handleToggleSelectAll(true));
    expect(result.current.willDeleteBook).toBe(true);
  });

  it("handleBulkDeleteConfirm is a no-op when nothing is selected", async () => {
    const { result } = renderHook(() => useBookDetail(BASE_BOOK));
    await act(async () => {
      await result.current.handleBulkDeleteConfirm();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("handleBulkDeleteConfirm on 204 removes selected chapters and exits selection mode", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(204));

    const { result } = renderHook(() => useBookDetail(BASE_BOOK));
    act(() => result.current.enterSelectionMode());
    act(() => result.current.handleToggleSelected("c-1", true));

    await act(async () => {
      await result.current.handleBulkDeleteConfirm();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/books/b-1/chapters/bulk-delete",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.current.state.chapters.map((c) => c.id)).toEqual(["c-2"]);
    expect(result.current.isSelectionMode).toBe(false);
  });

  it("handleBulkDeleteConfirm on 204 with X-Book-Deleted redirects to /books", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 204, headers: { "X-Book-Deleted": "true" } }),
    );

    const { result } = renderHook(() => useBookDetail(BASE_BOOK));
    act(() => result.current.enterSelectionMode());
    act(() => result.current.handleToggleSelected("c-1", true));

    await act(async () => {
      await result.current.handleBulkDeleteConfirm();
    });

    expect(routerPush).toHaveBeenCalledWith("/books");
  });

  it("handleBulkDeleteConfirm on error fires toast.error with server message", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: { code: "X", message: "Server reason." } }),
    );

    const { result } = renderHook(() => useBookDetail(BASE_BOOK));
    act(() => result.current.enterSelectionMode());
    act(() => result.current.handleToggleSelected("c-1", true));

    await act(async () => {
      await result.current.handleBulkDeleteConfirm();
    });

    expect(toast.error).toHaveBeenCalledWith("Server reason.");
  });
});
