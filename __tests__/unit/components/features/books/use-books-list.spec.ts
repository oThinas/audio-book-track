// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { buildBookSummaryRow } from "@tests/helpers/seed";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatedBook } from "@/components/features/books/book-create-dialog";
import { useBooksList } from "@/components/features/books/hooks/use-books-list";

describe("useBooksList", () => {
  let refreshMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    refreshMock = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: refreshMock,
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    } as unknown as ReturnType<typeof useRouter>);
  });

  it("returns initial books and empty filtered when search is empty", () => {
    const a = buildBookSummaryRow({ id: "a", title: "Alpha" });
    const b = buildBookSummaryRow({ id: "b", title: "Beta" });
    const { result } = renderHook(() => useBooksList([a, b]));

    expect(result.current.filteredBooks).toEqual([a, b]);
    expect(result.current.isCreateDialogOpen).toBe(false);
  });

  it("filters by title (case-insensitive substring)", () => {
    const a = buildBookSummaryRow({ id: "a", title: "Dom Casmurro" });
    const b = buildBookSummaryRow({ id: "b", title: "Memórias Póstumas" });
    const { result } = renderHook(() => useBooksList([a, b]));

    act(() => result.current.setSearch("DOM"));
    expect(result.current.filteredBooks.map((x) => x.id)).toEqual(["a"]);
  });

  it("filters by studio name", () => {
    const a = buildBookSummaryRow({ id: "a", studio: { id: "s1", name: "Sonora" } });
    const b = buildBookSummaryRow({ id: "b", studio: { id: "s2", name: "Other" } });
    const { result } = renderHook(() => useBooksList([a, b]));

    act(() => result.current.setSearch("sono"));
    expect(result.current.filteredBooks.map((x) => x.id)).toEqual(["a"]);
  });

  it("openCreateDialog sets isCreateDialogOpen=true", () => {
    const { result } = renderHook(() => useBooksList([]));
    act(() => result.current.openCreateDialog());
    expect(result.current.isCreateDialogOpen).toBe(true);
  });

  it("handleCreated optimistically prepends, closes dialog and refreshes", () => {
    const { result } = renderHook(() => useBooksList([]));
    const created: CreatedBook = {
      id: "new",
      title: "Brand New",
      studio: { id: "s-1", name: "Studio" },
      pricePerHourCents: 8000,
      chapters: [{ id: "c-1", number: 1 }],
    };

    act(() => result.current.openCreateDialog());
    act(() => result.current.handleCreated(created));

    expect(result.current.filteredBooks).toHaveLength(1);
    expect(result.current.filteredBooks[0]).toMatchObject({
      id: "new",
      title: "Brand New",
      status: "pending",
      totalChapters: 1,
      completedChapters: 0,
      totalEarningsCents: 0,
    });
    expect(result.current.isCreateDialogOpen).toBe(false);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
