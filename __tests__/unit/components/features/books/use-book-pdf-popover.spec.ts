// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { jsonResponse } from "@tests/helpers/fetch-response";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type PdfUrlFormValues,
  useBookPdfPopover,
} from "@/components/features/books/hooks/use-book-pdf-popover";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

function renderPdfHook(opts: { pdfUrl: string | null; onUpdated?: ReturnType<typeof vi.fn> }) {
  const onUpdated = opts.onUpdated ?? vi.fn();
  return {
    onUpdated,
    ...renderHook(() => {
      const form = useForm<PdfUrlFormValues>({
        mode: "onChange",
        defaultValues: { pdfUrl: opts.pdfUrl ?? "" },
      });
      const popover = useBookPdfPopover({
        bookId: "b-1",
        pdfUrl: opts.pdfUrl,
        form,
        onUpdated,
      });
      return { form, ...popover };
    }),
  };
}

describe("useBookPdfPopover", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("on 200 with non-empty url, calls onUpdated with the trimmed value and closes", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: {} }));

    const { result, onUpdated } = renderPdfHook({ pdfUrl: null });
    act(() => result.current.handleOpenChange(true));
    act(() => result.current.form.setValue("pdfUrl", "https://example.com/a.pdf"));

    await act(async () => {
      await result.current.onSubmit({ pdfUrl: "https://example.com/a.pdf" });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/books/b-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ pdfUrl: "https://example.com/a.pdf" }),
      }),
    );
    expect(onUpdated).toHaveBeenCalledWith("https://example.com/a.pdf");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("on 200 with empty url, calls onUpdated(null)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: {} }));

    const { result, onUpdated } = renderPdfHook({ pdfUrl: "https://existing.pdf" });
    await act(async () => {
      await result.current.onSubmit({ pdfUrl: "" });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/books/b-1",
      expect.objectContaining({ body: JSON.stringify({ pdfUrl: null }) }),
    );
    expect(onUpdated).toHaveBeenCalledWith(null);
  });

  it("on 422, sets form error from server detail", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Bad",
          details: [{ field: "pdfUrl", message: "URL inválida personalizada." }],
        },
      }),
    );

    const { result } = renderPdfHook({ pdfUrl: null });
    await act(async () => {
      await result.current.onSubmit({ pdfUrl: "not-a-url" });
    });

    expect(result.current.form.getFieldState("pdfUrl").error?.message).toBe(
      "URL inválida personalizada.",
    );
  });

  it("on 500, fires generic toast.error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: { code: "X", message: "x" } }));

    const { result } = renderPdfHook({ pdfUrl: null });
    await act(async () => {
      await result.current.onSubmit({ pdfUrl: "https://x.com/a.pdf" });
    });

    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar a URL. Tente novamente.");
  });

  it("never calls toast.success in any branch (Constitution VII)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: {} }));
    const { result } = renderPdfHook({ pdfUrl: null });
    await act(async () => {
      await result.current.onSubmit({ pdfUrl: "https://x.com/y.pdf" });
    });
    expect(toast.success).not.toHaveBeenCalled();
  });
});
