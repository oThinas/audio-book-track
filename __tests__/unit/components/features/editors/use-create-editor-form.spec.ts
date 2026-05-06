// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { jsonResponse } from "@tests/helpers/fetch-response";
import { buildEditor } from "@tests/helpers/seed";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateEditorForm } from "@/components/features/editors/hooks/use-create-editor-form";
import type { EditorFormValues } from "@/lib/domain/editor";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

function renderCreateHook(onCreated = vi.fn()) {
  return renderHook(() => {
    const form = useForm<EditorFormValues>({ defaultValues: { name: "", email: "" } });
    const created = useCreateEditorForm({ form, onCreated });
    return { form, ...created, onCreated };
  });
}

describe("useCreateEditorForm", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("exposes firstFieldRef for autofocus on mount", () => {
    const { result } = renderCreateHook();
    expect(result.current.firstFieldRef).toBeDefined();
    expect(result.current.firstFieldRef.current).toBeNull();
  });

  it("on 201, calls onCreated with the response data and never toast.error", async () => {
    const onCreated = vi.fn();
    const created = buildEditor({ id: "new", name: "Brand New", email: "new@studio.com" });
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { data: created }));

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({ name: "Brand New", email: "new@studio.com" });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/editors",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Brand New", email: "new@studio.com" }),
      }),
    );
    expect(onCreated).toHaveBeenCalledWith(JSON.parse(JSON.stringify(created)));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("on 422, maps name/email detail entries to form.setError", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid",
          details: [
            { field: "name", message: "Nome obrigatório" },
            { field: "email", message: "E-mail inválido" },
          ],
        },
      }),
    );

    const { result } = renderCreateHook();

    await act(async () => {
      await result.current.onSubmit({ name: "", email: "" });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome obrigatório");
    expect(result.current.form.getFieldState("email").error?.message).toBe("E-mail inválido");
  });

  it("on 409 NAME_ALREADY_IN_USE, marks the name field", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: { code: "NAME_ALREADY_IN_USE", message: "X" } }),
    );

    const { result } = renderCreateHook();

    await act(async () => {
      await result.current.onSubmit({ name: "Dup", email: "ok@studio.com" });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome já cadastrado");
  });

  it("on 409 EMAIL_ALREADY_IN_USE, marks the email field", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: { code: "EMAIL_ALREADY_IN_USE", message: "X" } }),
    );

    const { result } = renderCreateHook();

    await act(async () => {
      await result.current.onSubmit({ name: "Ok", email: "dup@studio.com" });
    });

    expect(result.current.form.getFieldState("email").error?.message).toBe("E-mail já cadastrado");
  });

  it("on 500, fires generic toast.error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(500, { error: { code: "INTERNAL", message: "boom" } }),
    );

    const { result } = renderCreateHook();

    await act(async () => {
      await result.current.onSubmit({ name: "X", email: "x@studio.com" });
    });

    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar o editor. Tente novamente.");
  });

  it("never calls toast.success in any branch", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { data: buildEditor() }));

    const { result } = renderCreateHook();

    await act(async () => {
      await result.current.onSubmit({ name: "X", email: "x@studio.com" });
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
