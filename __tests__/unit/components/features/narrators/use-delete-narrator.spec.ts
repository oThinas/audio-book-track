// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { buildNarrator } from "@tests/helpers/seed";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDeleteNarrator } from "@/components/features/narrators/hooks/use-delete-narrator";

vi.mock("@/lib/api/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@/lib/api/api-fetch");

describe("useDeleteNarrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handleConfirm is a no-op when narrator is null", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useDeleteNarrator({ narrator: null, onConfirmed, onOpenChange }),
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
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: true, data: null });
    const narrator = buildNarrator({ id: "abc" });

    const { result } = renderHook(() => useDeleteNarrator({ narrator, onConfirmed, onOpenChange }));

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/narrators/abc",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(onConfirmed).toHaveBeenCalledWith("abc");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("on NARRATOR_LINKED_TO_ACTIVE_CHAPTERS, closes the dialog without confirming", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "NARRATOR_LINKED_TO_ACTIVE_CHAPTERS",
      details: { books: [{ id: "b-1", title: "Livro X" }] },
    });
    const narrator = buildNarrator({ id: "abc" });

    const { result } = renderHook(() => useDeleteNarrator({ narrator, onConfirmed, onOpenChange }));

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it("on NARRATOR_NOT_FOUND, treats as success (item already gone)", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "NARRATOR_NOT_FOUND",
    });
    const narrator = buildNarrator({ id: "abc" });

    const { result } = renderHook(() => useDeleteNarrator({ narrator, onConfirmed, onOpenChange }));

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
    const narrator = buildNarrator({ id: "abc" });

    const { result } = renderHook(() => useDeleteNarrator({ narrator, onConfirmed, onOpenChange }));

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirmed).not.toHaveBeenCalled();
  });
});
