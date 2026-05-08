// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type PdfUrlFormValues,
  useBookPdfPopover,
} from "@/components/features/books/hooks/use-book-pdf-popover";

vi.mock("@/lib/api/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@/lib/api/api-fetch");

function renderPdfHook(opts: { pdfUrl: string | null; onUpdated?: (next: string | null) => void }) {
  const onUpdated = opts.onUpdated ?? vi.fn<(next: string | null) => void>();
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("on success with non-empty url, calls onUpdated with the trimmed value and closes", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: true, data: {}, headers: new Headers() });

    const { result, onUpdated } = renderPdfHook({ pdfUrl: null });
    act(() => result.current.handleOpenChange(true));
    act(() => result.current.form.setValue("pdfUrl", "https://example.com/a.pdf"));

    await act(async () => {
      await result.current.onSubmit({ pdfUrl: "https://example.com/a.pdf" });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/books/b-1",
      expect.objectContaining({
        method: "PATCH",
        body: { pdfUrl: "https://example.com/a.pdf" },
      }),
    );
    expect(onUpdated).toHaveBeenCalledWith("https://example.com/a.pdf");
  });

  it("on success with empty url, calls onUpdated(null)", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: true, data: {}, headers: new Headers() });

    const { result, onUpdated } = renderPdfHook({ pdfUrl: "https://existing.pdf" });
    await act(async () => {
      await result.current.onSubmit({ pdfUrl: "" });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/books/b-1",
      expect.objectContaining({ body: { pdfUrl: null } }),
    );
    expect(onUpdated).toHaveBeenCalledWith(null);
  });

  it("on field-errors, sets form error from server detail", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "field-errors",
      fields: { pdfUrl: "URL inválida personalizada." },
    });

    const { result } = renderPdfHook({ pdfUrl: null });
    await act(async () => {
      await result.current.onSubmit({ pdfUrl: "not-a-url" });
    });

    expect(result.current.form.getFieldState("pdfUrl").error?.message).toBe(
      "URL inválida personalizada.",
    );
  });

  it("on api-error, hook does not crash (toast handled by wrapper)", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "INTERNAL_ERROR",
    });

    const { result, onUpdated } = renderPdfHook({ pdfUrl: null });
    await act(async () => {
      await result.current.onSubmit({ pdfUrl: "https://x.com/a.pdf" });
    });

    expect(onUpdated).not.toHaveBeenCalled();
  });
});
