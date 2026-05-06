// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { jsonResponse } from "@tests/helpers/fetch-response";
import { buildEditor } from "@tests/helpers/seed";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdateEditorForm } from "@/components/features/editors/hooks/use-update-editor-form";
import type { EditorFormValues } from "@/lib/domain/editor";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

function renderUpdateHook(
  args: { editorId?: string; onUpdated?: ReturnType<typeof vi.fn>; onNotFound?: () => void } = {},
) {
  const onUpdated = args.onUpdated ?? vi.fn();
  return renderHook(() => {
    const form = useForm<EditorFormValues>({
      defaultValues: { name: "Old Name", email: "old@studio.com" },
    });
    const updated = useUpdateEditorForm({
      editorId: args.editorId ?? "e-1",
      form,
      onUpdated,
      onNotFound: args.onNotFound,
    });
    return { form, ...updated, onUpdated };
  });
}

describe("useUpdateEditorForm", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("on 200, calls onUpdated with the response data", async () => {
    const onUpdated = vi.fn();
    const updated = buildEditor({ id: "e-1", name: "Renamed", email: "renamed@studio.com" });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: updated }));

    const { result } = renderUpdateHook({ onUpdated });

    await act(async () => {
      await result.current.onSubmit({ name: "Renamed", email: "renamed@studio.com" });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/editors/e-1",
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed", email: "renamed@studio.com" }),
      }),
    );
    expect(onUpdated).toHaveBeenCalledWith(JSON.parse(JSON.stringify(updated)));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("on 422, maps detail entries to form.setError", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid",
          details: [
            { field: "name", message: "Inválido" },
            { field: "email", message: "Inválido" },
          ],
        },
      }),
    );

    const { result } = renderUpdateHook();

    await act(async () => {
      await result.current.onSubmit({ name: "", email: "" });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Inválido");
    expect(result.current.form.getFieldState("email").error?.message).toBe("Inválido");
  });

  it("on 409 NAME_ALREADY_IN_USE marks the name field", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: { code: "NAME_ALREADY_IN_USE", message: "X" } }),
    );

    const { result } = renderUpdateHook();

    await act(async () => {
      await result.current.onSubmit({ name: "Dup", email: "ok@studio.com" });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome já cadastrado");
  });

  it("on 409 EMAIL_ALREADY_IN_USE marks the email field", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: { code: "EMAIL_ALREADY_IN_USE", message: "X" } }),
    );

    const { result } = renderUpdateHook();

    await act(async () => {
      await result.current.onSubmit({ name: "Ok", email: "dup@studio.com" });
    });

    expect(result.current.form.getFieldState("email").error?.message).toBe("E-mail já cadastrado");
  });

  it("on 404, fires toast.error and invokes onNotFound", async () => {
    const onNotFound = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(404, { error: { code: "NOT_FOUND", message: "x" } }),
    );

    const { result } = renderUpdateHook({ onNotFound });

    await act(async () => {
      await result.current.onSubmit({ name: "X", email: "x@studio.com" });
    });

    expect(toast.error).toHaveBeenCalledWith("Editor não existe mais.");
    expect(onNotFound).toHaveBeenCalledTimes(1);
  });

  it("on 500, fires generic toast.error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(500, { error: { code: "INTERNAL", message: "boom" } }),
    );

    const { result } = renderUpdateHook();

    await act(async () => {
      await result.current.onSubmit({ name: "X", email: "x@studio.com" });
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível atualizar o editor. Tente novamente.",
    );
  });

  it("never calls toast.success in any branch", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: buildEditor() }));

    const { result } = renderUpdateHook();

    await act(async () => {
      await result.current.onSubmit({ name: "X", email: "x@studio.com" });
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
