// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { emptyResponse, jsonResponse } from "@tests/helpers/fetch-response";
import { buildNarrator } from "@tests/helpers/seed";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDeleteNarrator } from "@/components/features/narrators/hooks/use-delete-narrator";
import type { Narrator } from "@/lib/domain/narrator";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

function renderDeleteHook(
  args: {
    narrator?: Narrator | null;
    onConfirmed?: (id: string) => void;
    onOpenChange?: (open: boolean) => void;
  } = {},
) {
  const onConfirmed = args.onConfirmed ?? vi.fn<(id: string) => void>();
  const onOpenChange = args.onOpenChange ?? vi.fn<(open: boolean) => void>();
  return {
    onConfirmed,
    onOpenChange,
    ...renderHook(
      ({ narrator }: { narrator: Narrator | null }) =>
        useDeleteNarrator({ narrator, onConfirmed, onOpenChange }),
      {
        initialProps: {
          narrator: args.narrator === undefined ? buildNarrator({ id: "n-1" }) : args.narrator,
        },
      },
    ),
  };
}

describe("useDeleteNarrator", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("starts with isDeleting=false", () => {
    const { result } = renderDeleteHook();
    expect(result.current.isDeleting).toBe(false);
  });

  it("handleConfirm is a no-op when narrator is null", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    const { result } = renderDeleteHook({ narrator: null, onConfirmed, onOpenChange });

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("on 204, fires onConfirmed and closes the dialog", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    fetchMock.mockResolvedValueOnce(emptyResponse(204));

    const narrator = buildNarrator({ id: "n-1" });
    const { result } = renderDeleteHook({ narrator, onConfirmed, onOpenChange });

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/narrators/n-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(onConfirmed).toHaveBeenCalledWith("n-1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("on 404, treats it as a successful confirm (idempotent delete)", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    fetchMock.mockResolvedValueOnce(emptyResponse(404));

    const narrator = buildNarrator({ id: "n-1" });
    const { result } = renderDeleteHook({ narrator, onConfirmed, onOpenChange });

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(onConfirmed).toHaveBeenCalledWith("n-1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("on 409 NARRATOR_LINKED_TO_ACTIVE_CHAPTERS, shows toast.error with book titles preview and closes", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, {
        error: {
          code: "NARRATOR_LINKED_TO_ACTIVE_CHAPTERS",
          message: "Linked",
          details: {
            books: [
              { id: "b-1", title: "Book A" },
              { id: "b-2", title: "Book B" },
              { id: "b-3", title: "Book C" },
              { id: "b-4", title: "Book D" },
            ],
          },
        },
      }),
    );

    const narrator = buildNarrator({ id: "n-1" });
    const { result } = renderDeleteHook({ narrator, onConfirmed, onOpenChange });

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Não é possível excluir: capítulos em 4 livro(s) ativo(s).",
      { description: "Book A, Book B, Book C e mais 1" },
    );
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("on 409 with 1 book, shows description without 'e mais'", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, {
        error: {
          code: "NARRATOR_LINKED_TO_ACTIVE_CHAPTERS",
          message: "Linked",
          details: { books: [{ id: "b-1", title: "Only Book" }] },
        },
      }),
    );

    const { result } = renderDeleteHook({ narrator: buildNarrator(), onConfirmed, onOpenChange });

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Não é possível excluir: capítulos em 1 livro(s) ativo(s).",
      { description: "Only Book" },
    );
  });

  it("on 500, fires generic toast.error and does not confirm", async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(500, { error: { code: "INTERNAL", message: "boom" } }),
    );

    const narrator = buildNarrator({ id: "n-1" });
    const { result } = renderDeleteHook({ narrator, onConfirmed, onOpenChange });

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível excluir o narrador. Tente novamente.",
    );
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it("toggles isDeleting during the request and resets after completion", async () => {
    let resolveFetch: ((value: Response) => void) | null = null;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const narrator = buildNarrator({ id: "n-1" });
    const { result } = renderDeleteHook({ narrator });

    let confirmPromise!: Promise<void>;
    act(() => {
      confirmPromise = result.current.handleConfirm();
    });

    expect(result.current.isDeleting).toBe(true);

    await act(async () => {
      resolveFetch?.(emptyResponse(204));
      await confirmPromise;
    });

    expect(result.current.isDeleting).toBe(false);
  });
});
