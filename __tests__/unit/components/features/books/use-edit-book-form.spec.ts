// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
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

vi.mock("@/lib/api/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@/lib/api/api-fetch");

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
  const onUpdated =
    vi.fn<(d: import("@/components/features/books/book-edit-dialog").UpdatedBookDetail) => void>();
  const onOpenChange = vi.fn<(open: boolean) => void>();
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
        },
      });
      const result = useEditBookForm({ book, studios, form, onUpdated, onOpenChange });
      return { form, ...result };
    }),
  };
}

function successResult(data: unknown) {
  return { ok: true as const, data, headers: new Headers() };
}

describe("useEditBookForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("studioOptions matches the supplied list when no inline studio added", () => {
    const { result, studios } = renderEditBookHook();
    expect(result.current.studioOptions).toBe(studios);
  });

  it("on no changes, closes the dialog without firing apiFetch", async () => {
    const { result, onOpenChange } = renderEditBookHook();

    await act(async () => {
      await result.current.onSubmit({
        title: "Old Title",
        studioId: "s-A",
        pricePerHourCents: 5000,
      });
    });

    expect(apiFetch).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("on success, calls onUpdated with detail and closes", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(successResult({ data: { id: "b-1" } }));

    const { result, onUpdated, onOpenChange } = renderEditBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "New Title",
        studioId: "s-A",
        pricePerHourCents: 5000,
      });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/books/b-1",
      expect.objectContaining({ method: "PATCH", body: { title: "New Title" } }),
    );
    expect(onUpdated).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("on BOOK_PAID_PRICE_LOCKED api-error, sets pricePerHourCents error", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "BOOK_PAID_PRICE_LOCKED",
    });

    const { result } = renderEditBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "Old Title",
        studioId: "s-A",
        pricePerHourCents: 9999,
      });
    });

    expect(result.current.form.getFieldState("pricePerHourCents").error?.message).toBe(
      "Valor/hora não pode ser alterado: já há capítulo pago.",
    );
  });

  it("on BOOK_PAID_STUDIO_LOCKED api-error, sets studioId error", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "BOOK_PAID_STUDIO_LOCKED",
    });

    const { result } = renderEditBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "Old Title",
        studioId: "s-B",
        pricePerHourCents: 5000,
      });
    });

    expect(result.current.form.getFieldState("studioId").error?.message).toBe(
      "Estúdio não pode ser alterado: já há capítulo pago.",
    );
  });

  it("on TITLE_ALREADY_IN_USE api-error, sets title error", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "TITLE_ALREADY_IN_USE",
    });

    const { result } = renderEditBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "Dup",
        studioId: "s-A",
        pricePerHourCents: 5000,
      });
    });

    expect(result.current.form.getFieldState("title").error?.message).toBe(
      "Já existe um livro com este título neste estúdio.",
    );
  });

  it("warns when closing dialog with unbound inline studio", () => {
    const { result } = renderEditBookHook();
    const inline = buildStudio({ id: "s-inline", name: "Inline" });
    act(() => result.current.handleInlineStudioCreated(inline));

    act(() => result.current.handleOpenChange(false));

    expect(toast.warning).toHaveBeenCalled();
  });
});
