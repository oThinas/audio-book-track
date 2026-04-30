// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { emptyResponse, jsonResponse } from "@tests/helpers/fetch-response";
import { buildStudio } from "@tests/helpers/seed";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDeleteStudio } from "@/components/features/studios/hooks/use-delete-studio";
import type { Studio } from "@/lib/domain/studio";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

describe("useDeleteStudio", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
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

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("on 204, calls onConfirmed(id) and onOpenChange(false)", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    fetchMock.mockResolvedValueOnce(emptyResponse(204));
    const studio = buildStudio({ id: "abc" });

    const { result } = renderHook(() => useDeleteStudio({ studio, onConfirmed, onOpenChange }));

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/studios/abc",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(onConfirmed).toHaveBeenCalledWith("abc");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("on 409 STUDIO_HAS_ACTIVE_BOOKS, sets a PT-BR error and keeps the dialog open", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, {
        error: {
          code: "STUDIO_HAS_ACTIVE_BOOKS",
          message: "tem livros",
          details: { books: [{ id: "b-1", title: "Livro X" }] },
        },
      }),
    );
    const studio = buildStudio({ id: "abc" });

    const { result } = renderHook(() => useDeleteStudio({ studio, onConfirmed, onOpenChange }));

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.toLowerCase()).toContain("livro");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("on 500, fires toast.error and closes the dialog", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(500, { error: { code: "INTERNAL", message: "boom" } }),
    );
    const studio = buildStudio({ id: "abc" });

    const { result } = renderHook(() => useDeleteStudio({ studio, onConfirmed, onOpenChange }));

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível excluir o estúdio. Tente novamente.",
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it("never calls toast.success in any branch", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    fetchMock.mockResolvedValueOnce(emptyResponse(204));
    const studio = buildStudio({ id: "abc" });

    const { result } = renderHook(() => useDeleteStudio({ studio, onConfirmed, onOpenChange }));

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });

  it("resets error when the studio prop changes", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, {
        error: { code: "STUDIO_HAS_ACTIVE_BOOKS", message: "x" },
      }),
    );

    const initialStudio = buildStudio({ id: "first" });
    const { result, rerender } = renderHook(
      ({ studio }: { studio: Studio | null }) =>
        useDeleteStudio({ studio, onConfirmed, onOpenChange }),
      { initialProps: { studio: initialStudio } },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });
    expect(result.current.error).toBeTruthy();

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
    let resolveFetch: (response: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
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
      resolveFetch(emptyResponse(204));
      await confirmPromise;
    });

    expect(result.current.isDeleting).toBe(false);
  });
});
