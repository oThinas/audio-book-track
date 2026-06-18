// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { buildEditor } from "@tests/helpers/seed";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdateEditorForm } from "@/components/features/editors/hooks/use-update-editor-form";
import type { EditorFormValues } from "@/lib/domain/editor";

vi.mock("@/lib/api/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@/lib/api/api-fetch");

function renderUpdateHook(editorId = "e-1", onUpdated = vi.fn(), onNotFound = vi.fn()) {
  return renderHook(() => {
    const form = useForm<EditorFormValues>({
      defaultValues: { name: "Old", email: "old@studio.com" },
    });
    const update = useUpdateEditorForm({ editorId, form, onUpdated, onNotFound });
    return { form, ...update, onUpdated, onNotFound };
  });
}

describe("useUpdateEditorForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("on success, calls onUpdated with the response data", async () => {
    const onUpdated = vi.fn();
    const updated = buildEditor({ id: "e-1", name: "Updated", email: "u@studio.com" });
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      data: { data: updated },
      headers: new Headers(),
    });

    const { result } = renderUpdateHook("e-1", onUpdated);

    await act(async () => {
      await result.current.onSubmit({ name: "Updated", email: "u@studio.com" });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/editors/e-1",
      expect.objectContaining({
        method: "PATCH",
        body: { name: "Updated", email: "u@studio.com" },
      }),
    );
    expect(onUpdated).toHaveBeenCalledWith(updated);
  });

  it("on field-errors, calls form.setError per field", async () => {
    const onUpdated = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "field-errors",
      fields: { name: "Nome obrigatório", email: "E-mail inválido." },
    });

    const { result } = renderUpdateHook("e-1", onUpdated);

    await act(async () => {
      await result.current.onSubmit({ name: "", email: "x" });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome obrigatório");
    expect(result.current.form.getFieldState("email").error?.message).toBe("E-mail inválido.");
  });

  it("on NAME_ALREADY_IN_USE api-error, marks the name field", async () => {
    const onUpdated = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "NAME_ALREADY_IN_USE",
    });

    const { result } = renderUpdateHook("e-1", onUpdated);

    await act(async () => {
      await result.current.onSubmit({ name: "Dup", email: "x@y.com" });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome já cadastrado.");
  });

  it("on EMAIL_ALREADY_IN_USE api-error, marks the email field", async () => {
    const onUpdated = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "EMAIL_ALREADY_IN_USE",
    });

    const { result } = renderUpdateHook("e-1", onUpdated);

    await act(async () => {
      await result.current.onSubmit({ name: "A", email: "dup@studio.com" });
    });

    expect(result.current.form.getFieldState("email").error?.message).toBe("E-mail já cadastrado.");
  });

  it("on EDITOR_NOT_FOUND api-error, calls onNotFound", async () => {
    const onUpdated = vi.fn();
    const onNotFound = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "EDITOR_NOT_FOUND",
    });

    const { result } = renderUpdateHook("e-1", onUpdated, onNotFound);

    await act(async () => {
      await result.current.onSubmit({ name: "x", email: "x@y.com" });
    });

    expect(onNotFound).toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
  });
});
