// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { buildStudio } from "@tests/helpers/seed";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateBookForm } from "@/components/features/books/hooks/use-create-book-form";
import type { CreateBookInput } from "@/lib/schemas/book";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/api/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@/lib/api/api-fetch");

function renderCreateBookHook(
  args: {
    studios?: ReturnType<typeof buildStudio>[];
    onCreated?: (
      book: import("@/components/features/books/book-create-dialog").CreatedBook,
    ) => void;
    onOpenChange?: (open: boolean) => void;
  } = {},
) {
  const studios = args.studios ?? [
    buildStudio({ id: "s-A", name: "Alpha" }),
    buildStudio({ id: "s-Z", name: "Zeta" }),
  ];
  const onCreated =
    args.onCreated ??
    vi.fn<(book: import("@/components/features/books/book-create-dialog").CreatedBook) => void>();
  const onOpenChange = args.onOpenChange ?? vi.fn<(open: boolean) => void>();
  return {
    onCreated,
    onOpenChange,
    studios,
    ...renderHook(() => {
      const form = useForm<CreateBookInput>({
        defaultValues: {
          title: "",
          studioId: "",
          pricePerHourCents: 0,
          chapters: { numbered: 1, extras: [] },
        },
      });
      const result = useCreateBookForm({ studios, form, onCreated, onOpenChange });
      return { form, ...result };
    }),
  };
}

function successResult(data: unknown) {
  return { ok: true as const, data, headers: new Headers() };
}

describe("useCreateBookForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("on success, calls onCreated and POSTs payload (without inline marker when no inline)", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      successResult({
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
        chapters: { numbered: 1, extras: [] },
      });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/books",
      expect.objectContaining({
        method: "POST",
        body: {
          title: "Test",
          studioId: "s-A",
          pricePerHourCents: 8000,
          chapters: { numbered: 1, extras: [] },
        },
      }),
    );
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it("attaches inlineStudioId to payload when the selected studio was inline-created", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      successResult({
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
        chapters: { numbered: 1, extras: [] },
      });
    });

    const callBody = vi.mocked(apiFetch).mock.calls[0]?.[1]?.body as Record<string, unknown>;
    expect(callBody).toMatchObject({ inlineStudioId: "s-inline" });
  });

  it("on STUDIO_REFERENCE_INVALID api-error, sets studioId field error", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "STUDIO_REFERENCE_INVALID",
    });

    const { result } = renderCreateBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "T",
        studioId: "missing",
        pricePerHourCents: 1,
        chapters: { numbered: 1, extras: [] },
      });
    });

    expect(result.current.form.getFieldState("studioId").error?.message).toBe(
      "Estúdio não encontrado ou arquivado.",
    );
  });

  it("on INLINE_STUDIO_INVALID api-error, sets studioId field error", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "INLINE_STUDIO_INVALID",
    });

    const { result } = renderCreateBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "T",
        studioId: "x",
        pricePerHourCents: 1,
        chapters: { numbered: 1, extras: [] },
      });
    });

    expect(result.current.form.getFieldState("studioId").error?.message).toBe(
      "Estúdio inline inválido. Selecione outro estúdio.",
    );
  });

  it("on field-errors, maps to form.setError", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "field-errors",
      fields: { title: "Título é obrigatório" },
    });

    const { result } = renderCreateBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "",
        studioId: "s-A",
        pricePerHourCents: 1,
        chapters: { numbered: 1, extras: [] },
      });
    });

    expect(result.current.form.getFieldState("title").error?.message).toBe("Título é obrigatório");
  });

  it("on TITLE_ALREADY_IN_USE api-error, sets title field error", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "TITLE_ALREADY_IN_USE",
    });

    const { result } = renderCreateBookHook();
    await act(async () => {
      await result.current.onSubmit({
        title: "Dup",
        studioId: "s-A",
        pricePerHourCents: 1,
        chapters: { numbered: 1, extras: [] },
      });
    });

    expect(result.current.form.getFieldState("title").error?.message).toBe(
      "Já existe um livro com este título neste estúdio.",
    );
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
});
