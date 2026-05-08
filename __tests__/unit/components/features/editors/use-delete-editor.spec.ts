// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { buildEditor } from "@tests/helpers/seed";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDeleteEditor } from "@/components/features/editors/hooks/use-delete-editor";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/api/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@/lib/api/api-fetch");

function successResult() {
  return { ok: true as const, data: null, headers: new Headers() };
}

describe("useDeleteEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handleConfirm is a no-op when editor is null", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useDeleteEditor({ editor: null, onConfirmed, onOpenChange }),
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(apiFetch).not.toHaveBeenCalled();
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it("on success, calls onConfirmed(id) and closes the dialog", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce(successResult());
    const editor = buildEditor({ id: "abc" });

    const { result } = renderHook(() => useDeleteEditor({ editor, onConfirmed, onOpenChange }));

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/editors/abc",
      expect.objectContaining({
        method: "DELETE",
        suppressToastFor: ["EDITOR_LINKED_TO_ACTIVE_CHAPTERS"],
      }),
    );
    expect(onConfirmed).toHaveBeenCalledWith("abc");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("on EDITOR_LINKED_TO_ACTIVE_CHAPTERS, fires rich toast.warning with blocking books", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "EDITOR_LINKED_TO_ACTIVE_CHAPTERS",
      details: { books: [{ id: "b-1", title: "Livro X" }] },
    });
    const editor = buildEditor({ id: "abc" });

    const { result } = renderHook(() => useDeleteEditor({ editor, onConfirmed, onOpenChange }));

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(toast.warning).toHaveBeenCalledWith(
      "Não é possível excluir: capítulos em 1 livro(s) ativo(s).",
      { description: "Livro X" },
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it("on EDITOR_NOT_FOUND, treats as success (item already gone)", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "EDITOR_NOT_FOUND",
    });
    const editor = buildEditor({ id: "abc" });

    const { result } = renderHook(() => useDeleteEditor({ editor, onConfirmed, onOpenChange }));

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(onConfirmed).toHaveBeenCalledWith("abc");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("on generic api-error, closes the dialog without confirming", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "INTERNAL_ERROR",
    });
    const editor = buildEditor({ id: "abc" });

    const { result } = renderHook(() => useDeleteEditor({ editor, onConfirmed, onOpenChange }));

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });
});
