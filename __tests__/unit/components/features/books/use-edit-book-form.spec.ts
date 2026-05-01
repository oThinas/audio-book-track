// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { jsonResponse } from "@tests/helpers/fetch-response";
import { buildStudio } from "@tests/helpers/seed";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookEditValues } from "@/components/features/books/book-edit-dialog";
import { useEditBookForm } from "@/components/features/books/hooks/use-edit-book-form";
import type { UpdateBookInput } from "@/lib/schemas/book";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const BOOK: BookEditValues = {
  id: "b-1",
  title: "Old Title",
  studioId: "s-A",
  pricePerHourCents: 5000,
  currentChapters: 3,
  hasPaidChapter: false,
};

function renderEditBookHook(overrides: Partial<BookEditValues> = {}) {
  const book = { ...BOOK, ...overrides };
  const studios = [
    buildStudio({ id: "s-A", name: "Alpha" }),
    buildStudio({ id: "s-B", name: "Beta" }),
  ];
  const onUpdated = vi.fn();
  const onOpenChange = vi.fn();
  return {
    book,
    studios,
    onUpdated,
    onOpenChange,
    ...renderHook(() => {
      const form = useForm<UpdateBookInput>({
        values: {
          title: book.title,
          studioId: book.studioId,
          pricePerHourCents: book.pricePerHourCents,
          numChapters: book.currentChapters,
        },
      });
      const result = useEditBookForm({ book, studios, form, onUpdated, onOpenChange });
      return { form, ...result };
    }),
  };
}

describe("useEditBookForm", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("studioOptions matches the supplied list when no inline studio added", () => {
    const { result, studios } = renderEditBookHook();
    expect(result.current.studioOptions).toBe(studios);
  });

  it("on no changes, closes the dialog without firing fetch", async () => {
    const { result, onOpenChange } = renderEditBookHook();

    await act(async () => {
      await result.current.onSubmit({
        title: "Old Title",
        studioId: "s-A",
        pricePerHourCents: 5000,
        numChapters: 3,
      });
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("on 200 success, calls onUpdated with detail and closes", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { id: "b-1" } }));

    const { result, onUpdated, onOpenChange } = renderEditBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "New Title",
        studioId: "s-A",
        pricePerHourCents: 5000,
        numChapters: 3,
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/books/b-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "New Title" }),
      }),
    );
    expect(onUpdated).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("on 422 CANNOT_REDUCE_CHAPTERS, sets numChapters error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, { error: { code: "CANNOT_REDUCE_CHAPTERS", message: "x" } }),
    );

    const { result } = renderEditBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "Old Title",
        studioId: "s-A",
        pricePerHourCents: 5000,
        numChapters: 5,
      });
    });

    expect(result.current.form.getFieldState("numChapters").error?.message).toBe(
      "Para reduzir a quantidade, use 'Excluir capítulos'.",
    );
  });

  it("on 409 BOOK_PAID_PRICE_LOCKED, sets pricePerHourCents error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: { code: "BOOK_PAID_PRICE_LOCKED", message: "x" } }),
    );

    const { result } = renderEditBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "Old Title",
        studioId: "s-A",
        pricePerHourCents: 9999,
        numChapters: 3,
      });
    });

    expect(result.current.form.getFieldState("pricePerHourCents").error?.message).toBe(
      "Valor/hora não pode ser alterado: já há capítulo pago.",
    );
  });

  it("on 409 BOOK_PAID_STUDIO_LOCKED, sets studioId error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: { code: "BOOK_PAID_STUDIO_LOCKED", message: "x" } }),
    );

    const { result } = renderEditBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "Old Title",
        studioId: "s-B",
        pricePerHourCents: 5000,
        numChapters: 3,
      });
    });

    expect(result.current.form.getFieldState("studioId").error?.message).toBe(
      "Estúdio não pode ser alterado: já há capítulo pago.",
    );
  });

  it("on 409 TITLE_ALREADY_IN_USE, sets title error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: { code: "TITLE_ALREADY_IN_USE", message: "x" } }),
    );

    const { result } = renderEditBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "Dup",
        studioId: "s-A",
        pricePerHourCents: 5000,
        numChapters: 3,
      });
    });

    expect(result.current.form.getFieldState("title").error?.message).toBe(
      "Já existe um livro com este título neste estúdio.",
    );
  });

  it("on 500, fires generic toast.error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: { code: "X", message: "x" } }));

    const { result } = renderEditBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "Different",
        studioId: "s-A",
        pricePerHourCents: 5000,
        numChapters: 3,
      });
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível atualizar o livro. Tente novamente.",
    );
  });

  it("warns when closing dialog with unbound inline studio", () => {
    const { result } = renderEditBookHook();
    const inline = buildStudio({ id: "s-inline", name: "Inline" });
    act(() => result.current.handleInlineStudioCreated(inline));

    act(() => result.current.handleOpenChange(false));

    expect(toast.warning).toHaveBeenCalled();
  });

  it("setReduceHint toggles reduceHint", () => {
    const { result } = renderEditBookHook();
    act(() => result.current.setReduceHint(true));
    expect(result.current.reduceHint).toBe(true);
  });
});
