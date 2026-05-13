// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChaptersGroupingState } from "@/components/features/chapters/hooks/use-chapters-grouping-state";

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

describe("useChaptersGroupingState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no groupBy param", () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams() as never);
    mockedUsePathname.mockReturnValue("/books/abc-123");
    const { result } = renderHook(() => useChaptersGroupingState());
    expect(result.current.grouping).toEqual([]);
  });

  it("parses single dimension from URL", () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("groupBy=narrator") as never);
    mockedUsePathname.mockReturnValue("/books/abc-123");
    const { result } = renderHook(() => useChaptersGroupingState());
    expect(result.current.grouping).toEqual(["narrator"]);
  });

  it("parses multi-level hierarchy preserving order", () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("groupBy=narrator,editor") as never);
    mockedUsePathname.mockReturnValue("/books/abc-123");
    const { result } = renderHook(() => useChaptersGroupingState());
    expect(result.current.grouping).toEqual(["narrator", "editor"]);
  });

  it("returns empty for invalid param (graceful, no throw)", () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("groupBy=foo") as never);
    mockedUsePathname.mockReturnValue("/books/abc-123");
    const { result } = renderHook(() => useChaptersGroupingState());
    expect(result.current.grouping).toEqual([]);
  });

  it("setGrouping([]) calls router.replace with pathname without groupBy", () => {
    const router = buildRouter();
    mockedUseRouter.mockReturnValue(router as never);
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("groupBy=narrator") as never);
    mockedUsePathname.mockReturnValue("/books/abc-123");

    const { result } = renderHook(() => useChaptersGroupingState());
    act(() => {
      result.current.setGrouping([]);
    });

    expect(router.replace).toHaveBeenCalledTimes(1);
    const [url, options] = router.replace.mock.calls[0];
    expect(url).toBe("/books/abc-123");
    expect(options).toEqual({ scroll: false });
  });

  it("setGrouping(['narrator']) writes ?groupBy=narrator", () => {
    const router = buildRouter();
    mockedUseRouter.mockReturnValue(router as never);
    mockedUseSearchParams.mockReturnValue(new URLSearchParams() as never);
    mockedUsePathname.mockReturnValue("/books/abc-123");

    const { result } = renderHook(() => useChaptersGroupingState());
    act(() => {
      result.current.setGrouping(["narrator"]);
    });

    expect(router.replace).toHaveBeenCalledTimes(1);
    const [url, options] = router.replace.mock.calls[0];
    expect(url).toBe("/books/abc-123?groupBy=narrator");
    expect(options).toEqual({ scroll: false });
  });

  it("setGrouping preserves other search params", () => {
    const router = buildRouter();
    mockedUseRouter.mockReturnValue(router as never);
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("foo=bar") as never);
    mockedUsePathname.mockReturnValue("/books/abc-123");

    const { result } = renderHook(() => useChaptersGroupingState());
    act(() => {
      result.current.setGrouping(["narrator", "editor"]);
    });

    expect(router.replace).toHaveBeenCalledTimes(1);
    const [url] = router.replace.mock.calls[0];
    // foo=bar persists, groupBy added
    expect(url).toMatch(/\/books\/abc-123\?/);
    expect(url).toContain("foo=bar");
    expect(url).toContain("groupBy=narrator%2Ceditor"); // URL-encoded comma
  });

  it("setGrouping([]) removes only groupBy and keeps other params", () => {
    const router = buildRouter();
    mockedUseRouter.mockReturnValue(router as never);
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("foo=bar&groupBy=narrator") as never);
    mockedUsePathname.mockReturnValue("/books/abc-123");

    const { result } = renderHook(() => useChaptersGroupingState());
    act(() => {
      result.current.setGrouping([]);
    });

    expect(router.replace).toHaveBeenCalledTimes(1);
    const [url] = router.replace.mock.calls[0];
    expect(url).toBe("/books/abc-123?foo=bar");
  });
});
