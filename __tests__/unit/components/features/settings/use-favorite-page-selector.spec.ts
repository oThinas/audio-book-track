// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFavoritePageSelector } from "@/components/features/settings/hooks/use-favorite-page-selector";

describe("useFavoritePageSelector", () => {
  it("starts with the initial value", () => {
    const { result } = renderHook(() =>
      useFavoritePageSelector({ initialValue: "studios", save: vi.fn() }),
    );

    expect(result.current.value).toBe("studios");
  });

  it("handleChange updates value and calls save with the new favoritePage", () => {
    const save = vi.fn();
    const { result } = renderHook(() => useFavoritePageSelector({ initialValue: "studios", save }));

    act(() => {
      result.current.handleChange("books");
    });

    expect(result.current.value).toBe("books");
    expect(save).toHaveBeenCalledWith({ favoritePage: "books" });
  });

  it("handleChange(null) is a no-op (no state update, no save)", () => {
    const save = vi.fn();
    const { result } = renderHook(() => useFavoritePageSelector({ initialValue: "studios", save }));

    act(() => {
      result.current.handleChange(null);
    });

    expect(result.current.value).toBe("studios");
    expect(save).not.toHaveBeenCalled();
  });
});
