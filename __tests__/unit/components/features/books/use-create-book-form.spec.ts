// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { jsonResponse } from "@tests/helpers/fetch-response";
import { buildStudio } from "@tests/helpers/seed";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateBookForm } from "@/components/features/books/hooks/use-create-book-form";
import type { CreateBookInput } from "@/lib/schemas/book";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

function renderCreateBookHook(
  args: {
    studios?: ReturnType<typeof buildStudio>[];
    onCreated?: ReturnType<typeof vi.fn>;
    onOpenChange?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const studios = args.studios ?? [
    buildStudio({ id: "s-A", name: "Alpha" }),
    buildStudio({ id: "s-Z", name: "Zeta" }),
  ];
  const onCreated = args.onCreated ?? vi.fn();
  const onOpenChange = args.onOpenChange ?? vi.fn();
  return {
    onCreated,
    onOpenChange,
    studios,
    ...renderHook(() => {
      const form = useForm<CreateBookInput>({
        defaultValues: { title: "", studioId: "", pricePerHourCents: 0, numChapters: 1 },
      });
      const result = useCreateBookForm({ studios, form, onCreated, onOpenChange });
      return { form, ...result };
    }),
  };
}

describe("useCreateBookForm", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("studioOptions matches the backend-supplied list when no inline creations exist", () => {
    const { result, studios } = renderCreateBookHook();
    expect(result.current.studioOptions).toBe(studios);
  });

  it("inserts an inline-created studio at the alphabetically correct position", () => {
    const { result } = renderCreateBookHook();

    const inline = buildStudio({ id: "s-M", name: "Mid" });
    act(() => result.current.handleInlineStudioCreated(inline));

    expect(result.current.studioOptions.map((s) => s.id)).toEqual(["s-A", "s-M", "s-Z"]);
  });

  it("appends inline studios at the end when their name comes last alphabetically", () => {
    const { result } = renderCreateBookHook();

    const inline = buildStudio({ id: "s-Late", name: "Zzz Late" });
    act(() => result.current.handleInlineStudioCreated(inline));

    expect(result.current.studioOptions.map((s) => s.id)).toEqual(["s-A", "s-Z", "s-Late"]);
  });

  it("on 201 success, calls onCreated and POSTs payload (without inline marker when no inline)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, {
        data: {
          id: "b-1",
          title: "Test",
          studioId: "s-A",
          pricePerHourCents: 8000,
          chapters: [{ id: "c-1", number: 1 }],
        },
      }),
    );

    const { result, onCreated } = renderCreateBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "Test",
        studioId: "s-A",
        pricePerHourCents: 8000,
        numChapters: 1,
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/books",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Test",
          studioId: "s-A",
          pricePerHourCents: 8000,
          numChapters: 1,
        }),
      }),
    );
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it("attaches inlineStudioId to payload when the selected studio was inline-created", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, {
        data: {
          id: "b-1",
          title: "T",
          studioId: "s-inline",
          pricePerHourCents: 1,
          chapters: [],
        },
      }),
    );

    const { result } = renderCreateBookHook();
    const inline = buildStudio({ id: "s-inline", name: "Inline" });
    act(() => result.current.handleInlineStudioCreated(inline));

    await act(async () => {
      await result.current.onSubmit({
        title: "T",
        studioId: "s-inline",
        pricePerHourCents: 1,
        numChapters: 1,
      });
    });

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body) as Record<string, unknown>;
    expect(callBody).toMatchObject({ inlineStudioId: "s-inline" });
  });

  it("on 422 STUDIO_NOT_FOUND, sets studioId field error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, { error: { code: "STUDIO_NOT_FOUND", message: "x" } }),
    );

    const { result } = renderCreateBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "T",
        studioId: "missing",
        pricePerHourCents: 1,
        numChapters: 1,
      });
    });

    expect(result.current.form.getFieldState("studioId").error?.message).toBe(
      "Estúdio não encontrado ou arquivado.",
    );
  });

  it("on 422 INLINE_STUDIO_INVALID, sets studioId field error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, { error: { code: "INLINE_STUDIO_INVALID", message: "x" } }),
    );

    const { result } = renderCreateBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "T",
        studioId: "x",
        pricePerHourCents: 1,
        numChapters: 1,
      });
    });

    expect(result.current.form.getFieldState("studioId").error?.message).toBe(
      "Estúdio inline inválido. Selecione outro estúdio.",
    );
  });

  it("on 422 with field detail, maps to form.setError", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Bad",
          details: [{ field: "title", message: "Título é obrigatório" }],
        },
      }),
    );

    const { result } = renderCreateBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "",
        studioId: "s-A",
        pricePerHourCents: 1,
        numChapters: 1,
      });
    });

    expect(result.current.form.getFieldState("title").error?.message).toBe("Título é obrigatório");
  });

  it("on 409, sets title field error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: { code: "CONFLICT", message: "x" } }),
    );

    const { result } = renderCreateBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "Dup",
        studioId: "s-A",
        pricePerHourCents: 1,
        numChapters: 1,
      });
    });

    expect(result.current.form.getFieldState("title").error?.message).toBe(
      "Já existe um livro com este título neste estúdio.",
    );
  });

  it("on 500, fires generic toast.error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: { code: "X", message: "x" } }));

    const { result } = renderCreateBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "T",
        studioId: "s-A",
        pricePerHourCents: 1,
        numChapters: 1,
      });
    });

    expect(toast.error).toHaveBeenCalledWith("Não foi possível criar o livro. Tente novamente.");
  });

  it("warns and resets when closing dialog with an unbound inline studio", () => {
    const { result, onOpenChange } = renderCreateBookHook();
    const inline = buildStudio({ id: "s-inline", name: "Inline" });
    act(() => result.current.handleInlineStudioCreated(inline));

    act(() => result.current.handleOpenChange(false));

    expect(toast.warning).toHaveBeenCalledWith(
      "Estúdio criado mas não vinculado: o valor/hora ficou em R$ 0,01. Edite-o quando puder.",
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("never calls toast.success in any branch", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, {
        data: { id: "b-1", title: "T", studioId: "s-A", pricePerHourCents: 1, chapters: [] },
      }),
    );

    const { result } = renderCreateBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "T",
        studioId: "s-A",
        pricePerHourCents: 1,
        numChapters: 1,
      });
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
