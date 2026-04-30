// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { buildStudio, buildStudioListItem } from "@tests/helpers/seed";
import { describe, expect, it, vi } from "vitest";
import { useStudioRow } from "@/components/features/studios/hooks/use-studio-row";

describe("useStudioRow", () => {
  it("starts in read mode", () => {
    const studio = buildStudioListItem();
    const { result } = renderHook(() => useStudioRow({ studio }));

    expect(result.current.isEditing).toBe(false);
  });

  it("handleStartEdit turns edit mode on", () => {
    const studio = buildStudioListItem();
    const { result } = renderHook(() => useStudioRow({ studio }));

    act(() => {
      result.current.handleStartEdit();
    });

    expect(result.current.isEditing).toBe(true);
  });

  it("handleCancelEdit turns edit mode off", () => {
    const studio = buildStudioListItem();
    const { result } = renderHook(() => useStudioRow({ studio }));

    act(() => {
      result.current.handleStartEdit();
    });
    act(() => {
      result.current.handleCancelEdit();
    });

    expect(result.current.isEditing).toBe(false);
  });

  it("handleEditCompleted turns edit mode off and forwards onUpdated", () => {
    const onUpdated = vi.fn();
    const studio = buildStudioListItem();
    const { result } = renderHook(() => useStudioRow({ studio, onUpdated }));

    act(() => {
      result.current.handleStartEdit();
    });

    const updated = buildStudio({ id: "s-1", name: "Updated" });
    act(() => {
      result.current.handleEditCompleted(updated);
    });

    expect(onUpdated).toHaveBeenCalledWith(updated);
    expect(result.current.isEditing).toBe(false);
  });

  it("canDelete reflects whether onRequestDelete was provided", () => {
    const studio = buildStudioListItem();

    const { result: withCallback } = renderHook(() =>
      useStudioRow({ studio, onRequestDelete: vi.fn() }),
    );
    expect(withCallback.current.canDelete).toBe(true);

    const { result: withoutCallback } = renderHook(() => useStudioRow({ studio }));
    expect(withoutCallback.current.canDelete).toBe(false);
  });

  it("handleRequestDelete forwards the raw studio to onRequestDelete", () => {
    const onRequestDelete = vi.fn();
    const studio = buildStudioListItem({ id: "s-1", name: "Target", booksCount: 3 });

    const { result } = renderHook(() => useStudioRow({ studio, onRequestDelete }));

    act(() => {
      result.current.handleRequestDelete();
    });

    expect(onRequestDelete).toHaveBeenCalledTimes(1);
    expect(onRequestDelete).toHaveBeenCalledWith(studio);
  });

  it("handleRequestDelete is a no-op when onRequestDelete is undefined", () => {
    const studio = buildStudioListItem();
    const { result } = renderHook(() => useStudioRow({ studio }));

    expect(() => {
      act(() => {
        result.current.handleRequestDelete();
      });
    }).not.toThrow();
  });
});
