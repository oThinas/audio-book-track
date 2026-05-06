// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { buildEditor, buildEditorListItem } from "@tests/helpers/seed";
import { describe, expect, it, vi } from "vitest";
import { useEditorRow } from "@/components/features/editors/hooks/use-editor-row";

describe("useEditorRow", () => {
  it("starts with isEditing=false", () => {
    const editor = buildEditorListItem();
    const { result } = renderHook(() => useEditorRow({ editor }));

    expect(result.current.isEditing).toBe(false);
  });

  it("handleStartEdit / handleCancelEdit toggle isEditing", () => {
    const editor = buildEditorListItem();
    const { result } = renderHook(() => useEditorRow({ editor }));

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
    const editor = buildEditorListItem({ id: "e-1" });
    const { result } = renderHook(() => useEditorRow({ editor, onUpdated }));

    act(() => {
      result.current.handleStartEdit();
    });

    const updated = buildEditor({ id: "e-1", name: "Renamed" });
    act(() => {
      result.current.handleEditCompleted(updated);
    });

    expect(onUpdated).toHaveBeenCalledWith(updated);
    expect(result.current.isEditing).toBe(false);
  });

  it("handleRequestDelete forwards the editor to onRequestDelete", () => {
    const onRequestDelete = vi.fn();
    const editor = buildEditorListItem({ id: "e-1" });
    const { result } = renderHook(() => useEditorRow({ editor, onRequestDelete }));

    act(() => {
      result.current.handleRequestDelete();
    });

    expect(onRequestDelete).toHaveBeenCalledWith(editor);
  });

  it("canDelete reflects whether onRequestDelete was supplied", () => {
    const editor = buildEditorListItem();
    const { result: withHandler } = renderHook(() =>
      useEditorRow({ editor, onRequestDelete: vi.fn() }),
    );
    const { result: withoutHandler } = renderHook(() => useEditorRow({ editor }));

    expect(withHandler.current.canDelete).toBe(true);
    expect(withoutHandler.current.canDelete).toBe(false);
  });
});
