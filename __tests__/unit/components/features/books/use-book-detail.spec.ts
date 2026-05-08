// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { buildChapterRowData } from "@tests/helpers/seed";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookDetailData } from "@/components/features/books/book-detail-client";
import { useBookDetail } from "@/components/features/books/hooks/use-book-detail";

vi.mock("@/lib/api/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@/lib/api/api-fetch");

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
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("handleBulkDeleteConfirm on success removes selected chapters and exits selection mode", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: true, data: null, headers: new Headers() });

    const { result } = renderHook(() => useBookDetail(BASE_BOOK));
    act(() => result.current.enterSelectionMode());
    act(() => result.current.handleToggleSelected("c-1", true));

    await act(async () => {
      await result.current.handleBulkDeleteConfirm();
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/books/b-1/chapters/bulk-delete",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.current.state.chapters.map((c) => c.id)).toEqual(["c-2"]);
    expect(result.current.isSelectionMode).toBe(false);
  });

  it("handleBulkDeleteConfirm on success with X-Book-Deleted redirects to /books", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      data: null,
      headers: new Headers({ "X-Book-Deleted": "true" }),
    });

    const { result } = renderHook(() => useBookDetail(BASE_BOOK));
    act(() => result.current.enterSelectionMode());
    act(() => result.current.handleToggleSelected("c-1", true));

    await act(async () => {
      await result.current.handleBulkDeleteConfirm();
    });

    expect(routerPush).toHaveBeenCalledWith("/books");
  });

  it("handleBulkDeleteConfirm on api-error keeps state intact (toast handled by wrapper)", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "CHAPTER_PAID_LOCKED",
    });

    const { result } = renderHook(() => useBookDetail(BASE_BOOK));
    act(() => result.current.enterSelectionMode());
    act(() => result.current.handleToggleSelected("c-1", true));

    await act(async () => {
      await result.current.handleBulkDeleteConfirm();
    });

    expect(result.current.state.chapters.map((c) => c.id)).toEqual(["c-1", "c-2"]);
  });
});
