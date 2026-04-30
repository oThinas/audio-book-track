// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { buildNarrator, buildNarratorListItem } from "@tests/helpers/seed";
import { describe, expect, it, vi } from "vitest";
import { useNarratorRow } from "@/components/features/narrators/hooks/use-narrator-row";

describe("useNarratorRow", () => {
  it("starts with isEditing=false", () => {
    const narrator = buildNarratorListItem();
    const { result } = renderHook(() => useNarratorRow({ narrator }));

    expect(result.current.isEditing).toBe(false);
  });

  it("handleStartEdit / handleCancelEdit toggle isEditing", () => {
    const narrator = buildNarratorListItem();
    const { result } = renderHook(() => useNarratorRow({ narrator }));

    act(() => {
      result.current.handleStartEdit();
    });
    expect(result.current.isEditing).toBe(true);

    act(() => {
      result.current.handleCancelEdit();
    });
    expect(result.current.isEditing).toBe(false);
  });

  it("handleEditCompleted forwards to onUpdated and exits edit mode", () => {
    const onUpdated = vi.fn();
    const narrator = buildNarratorListItem({ id: "n-1" });
    const { result } = renderHook(() => useNarratorRow({ narrator, onUpdated }));

    act(() => {
      result.current.handleStartEdit();
    });

    const updated = buildNarrator({ id: "n-1", name: "Renamed" });
    act(() => {
      result.current.handleEditCompleted(updated);
    });

    expect(onUpdated).toHaveBeenCalledWith(updated);
    expect(result.current.isEditing).toBe(false);
  });

  it("handleRequestDelete forwards the narrator to onRequestDelete", () => {
    const onRequestDelete = vi.fn();
    const narrator = buildNarratorListItem({ id: "n-1" });
    const { result } = renderHook(() => useNarratorRow({ narrator, onRequestDelete }));

    act(() => {
      result.current.handleRequestDelete();
    });

    expect(onRequestDelete).toHaveBeenCalledWith(narrator);
  });

  it("canDelete reflects whether onRequestDelete was supplied", () => {
    const narrator = buildNarratorListItem();
    const { result: withHandler } = renderHook(() =>
      useNarratorRow({ narrator, onRequestDelete: vi.fn() }),
    );
    const { result: withoutHandler } = renderHook(() => useNarratorRow({ narrator }));

    expect(withHandler.current.canDelete).toBe(true);
    expect(withoutHandler.current.canDelete).toBe(false);
  });
});
