// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChapterRowEntity } from "@/components/features/chapters/chapter-row";
import { useFocusWeekFilter } from "@/components/features/chapters/hooks/use-focus-week-filter";

const mockedUseSearchParams = vi.mocked(useSearchParams);
const mockedUsePathname = vi.mocked(usePathname);
const mockedUseRouter = vi.mocked(useRouter);

function buildRouter() {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  };
}

function chap(
  overrides: Partial<ChapterRowEntity> & Pick<ChapterRowEntity, "id">,
): ChapterRowEntity {
  return {
    number: 1,
    status: "pending",
    narrator: null,
    editor: null,
    editedSeconds: 0,
    deadline: null,
    ...overrides,
  };
}

describe("useFocusWeekFilter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enabled=false quando focus ausente", () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams() as never);
    mockedUsePathname.mockReturnValue("/books/abc");
    mockedUseRouter.mockReturnValue(buildRouter() as never);

    const { result } = renderHook(() => useFocusWeekFilter());
    expect(result.current.enabled).toBe(false);
  });

  it("enabled=true quando focus=week", () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("focus=week") as never);
    mockedUsePathname.mockReturnValue("/books/abc");
    mockedUseRouter.mockReturnValue(buildRouter() as never);

    const { result } = renderHook(() => useFocusWeekFilter());
    expect(result.current.enabled).toBe(true);
  });

  it("toggle adiciona ?focus=week na URL", () => {
    const router = buildRouter();
    mockedUseSearchParams.mockReturnValue(new URLSearchParams() as never);
    mockedUsePathname.mockReturnValue("/books/abc");
    mockedUseRouter.mockReturnValue(router as never);

    const { result } = renderHook(() => useFocusWeekFilter());
    act(() => result.current.toggle());

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace.mock.calls[0][0]).toBe("/books/abc?focus=week");
  });

  it("toggle remove ?focus=week da URL", () => {
    const router = buildRouter();
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("focus=week") as never);
    mockedUsePathname.mockReturnValue("/books/abc");
    mockedUseRouter.mockReturnValue(router as never);

    const { result } = renderHook(() => useFocusWeekFilter());
    act(() => result.current.toggle());

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace.mock.calls[0][0]).toBe("/books/abc");
  });

  it("toggle preserva outros params (ex: groupBy)", () => {
    const router = buildRouter();
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("groupBy=narrator") as never);
    mockedUsePathname.mockReturnValue("/books/abc");
    mockedUseRouter.mockReturnValue(router as never);

    const { result } = renderHook(() => useFocusWeekFilter());
    act(() => result.current.toggle());

    const url = router.replace.mock.calls[0][0] as string;
    expect(url).toContain("groupBy=narrator");
    expect(url).toContain("focus=week");
  });

  it("applyFilter retorna lista cheia quando disabled", () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams() as never);
    mockedUsePathname.mockReturnValue("/books/abc");
    mockedUseRouter.mockReturnValue(buildRouter() as never);

    const chapters: readonly ChapterRowEntity[] = [
      chap({ id: "1", deadline: null }),
      chap({ id: "2", deadline: "2026-06-15", status: "completed" }),
    ];
    const { result } = renderHook(() => useFocusWeekFilter());
    expect(result.current.applyFilter(chapters)).toEqual(chapters);
  });

  it("applyFilter remove sem-prazo/completed/paid quando enabled", () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("focus=week") as never);
    mockedUsePathname.mockReturnValue("/books/abc");
    mockedUseRouter.mockReturnValue(buildRouter() as never);

    const inWindow = "2026-06-15"; // out of week generally; but use today's week
    const chapters: readonly ChapterRowEntity[] = [
      chap({ id: "1", deadline: null }), // out
      chap({ id: "2", deadline: inWindow, status: "completed" }), // out
      chap({ id: "3", deadline: inWindow, status: "paid" }), // out
    ];
    const { result } = renderHook(() => useFocusWeekFilter());
    expect(result.current.applyFilter(chapters)).toEqual([]);
  });
});
