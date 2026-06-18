// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { buildEditor } from "@tests/helpers/seed";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateEditorForm } from "@/components/features/editors/hooks/use-create-editor-form";
import type { EditorFormValues } from "@/lib/domain/editor";

vi.mock("@/lib/api/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@/lib/api/api-fetch");

function renderCreateHook(onCreated = vi.fn()) {
  return renderHook(() => {
    const form = useForm<EditorFormValues>({ defaultValues: { name: "", email: "" } });
    const created = useCreateEditorForm({ form, onCreated });
    return { form, ...created, onCreated };
  });
}

describe("useCreateEditorForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("on success, calls onCreated with the response data", async () => {
    const onCreated = vi.fn();
    const created = buildEditor({ id: "new", name: "Brand New", email: "new@studio.com" });
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      data: { data: created },
      headers: new Headers(),
    });

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({ name: "Brand New", email: "new@studio.com" });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/editors",
      expect.objectContaining({
        method: "POST",
        body: { name: "Brand New", email: "new@studio.com" },
      }),
    );
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it("on field-errors, maps issues to form.setError", async () => {
    const onCreated = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "field-errors",
      fields: { name: "Nome obrigatório", email: "E-mail inválido." },
    });

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({ name: "", email: "x" });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome obrigatório");
    expect(result.current.form.getFieldState("email").error?.message).toBe("E-mail inválido.");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("on NAME_ALREADY_IN_USE api-error, marks the name field", async () => {
    const onCreated = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "NAME_ALREADY_IN_USE",
    });

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({ name: "Dup", email: "x@y.com" });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome já cadastrado.");
  });

  it("on EMAIL_ALREADY_IN_USE api-error, marks the email field", async () => {
    const onCreated = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "EMAIL_ALREADY_IN_USE",
    });

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({ name: "A", email: "dup@studio.com" });
    });

    expect(result.current.form.getFieldState("email").error?.message).toBe("E-mail já cadastrado.");
  });
});
