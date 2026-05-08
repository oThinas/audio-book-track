// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { buildStudio } from "@tests/helpers/seed";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDeleteStudio } from "@/components/features/studios/hooks/use-delete-studio";
import type { Studio } from "@/lib/domain/studio";

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

describe("useDeleteStudio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handleConfirm is a no-op when studio is null", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useDeleteStudio({ studio: null, onConfirmed, onOpenChange }),
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(apiFetch).not.toHaveBeenCalled();
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("on success, calls onConfirmed(id) and closes the dialog", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce(successResult());
    const studio = buildStudio({ id: "abc" });

    const { result } = renderHook(() => useDeleteStudio({ studio, onConfirmed, onOpenChange }));

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/studios/abc",
      expect.objectContaining({
        method: "DELETE",
        suppressToastFor: ["STUDIO_HAS_ACTIVE_BOOKS"],
      }),
    );
    expect(onConfirmed).toHaveBeenCalledWith("abc");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("on STUDIO_HAS_ACTIVE_BOOKS, fires rich toast.warning with blocking books and closes dialog", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "STUDIO_HAS_ACTIVE_BOOKS",
      details: { books: [{ id: "b-1", title: "Livro X" }] },
    });
    const studio = buildStudio({ id: "abc" });

    const { result } = renderHook(() => useDeleteStudio({ studio, onConfirmed, onOpenChange }));

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(toast.warning).toHaveBeenCalledWith(
      "Não é possível excluir: 1 livro(s) com capítulos ativos.",
      { description: "Livro X" },
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it("on STUDIO_NOT_FOUND, treats as success (item already gone)", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "STUDIO_NOT_FOUND",
    });
    const studio = buildStudio({ id: "abc" });

    const { result } = renderHook(() => useDeleteStudio({ studio, onConfirmed, onOpenChange }));

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
    const studio = buildStudio({ id: "abc" });

    const { result } = renderHook(() => useDeleteStudio({ studio, onConfirmed, onOpenChange }));

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("error state stays null when the studio prop changes (no inline error path)", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();

    const initialStudio = buildStudio({ id: "first" });
    const { result, rerender } = renderHook(
      ({ studio }: { studio: Studio | null }) =>
        useDeleteStudio({ studio, onConfirmed, onOpenChange }),
      { initialProps: { studio: initialStudio } },
    );

    expect(result.current.error).toBeNull();

    const otherStudio = buildStudio({ id: "second" });
    rerender({ studio: otherStudio });

    expect(result.current.error).toBeNull();
  });

  it("handleCancel calls onOpenChange(false)", () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    const studio = buildStudio({ id: "abc" });

    const { result } = renderHook(() => useDeleteStudio({ studio, onConfirmed, onOpenChange }));

    act(() => {
      result.current.handleCancel();
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("isDeleting reflects the request lifecycle", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    let resolveFetch: (value: ReturnType<typeof successResult>) => void = () => {};
    vi.mocked(apiFetch).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve as typeof resolveFetch;
      }),
    );
    const studio = buildStudio({ id: "abc" });

    const { result } = renderHook(() => useDeleteStudio({ studio, onConfirmed, onOpenChange }));

    expect(result.current.isDeleting).toBe(false);

    let confirmPromise: Promise<void> = Promise.resolve();
    act(() => {
      confirmPromise = result.current.handleConfirm();
    });
    expect(result.current.isDeleting).toBe(true);

    await act(async () => {
      resolveFetch(successResult());
      await confirmPromise;
    });

    expect(result.current.isDeleting).toBe(false);
  });
});
