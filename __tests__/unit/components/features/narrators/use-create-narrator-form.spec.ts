// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { buildNarrator } from "@tests/helpers/seed";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateNarratorForm } from "@/components/features/narrators/hooks/use-create-narrator-form";
import type { NarratorFormValues } from "@/lib/domain/narrator";

vi.mock("@/lib/api/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@/lib/api/api-fetch");

function renderCreateHook(onCreated = vi.fn()) {
  return renderHook(() => {
    const form = useForm<NarratorFormValues>({ defaultValues: { name: "" } });
    const created = useCreateNarratorForm({ form, onCreated });
    return { form, ...created, onCreated };
  });
}

describe("useCreateNarratorForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("on success, calls onCreated with the response data", async () => {
    const onCreated = vi.fn();
    const created = buildNarrator({ id: "new", name: "Brand New" });
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: true, data: { data: created } });

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({ name: "Brand New" });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/narrators",
      expect.objectContaining({ method: "POST", body: { name: "Brand New" } }),
    );
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it("on field-errors, calls form.setError on the name field", async () => {
    const onCreated = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "field-errors",
      fields: { name: "Nome obrigatório" },
    });

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({ name: "" });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome obrigatório");
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
      await result.current.onSubmit({ name: "Duplicate" });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome já cadastrado.");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("on generic api-error, hook does not call onCreated", async () => {
    const onCreated = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "INTERNAL_ERROR",
    });

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({ name: "Anything" });
    });

    expect(onCreated).not.toHaveBeenCalled();
    expect(result.current.form.getFieldState("name").error).toBeUndefined();
  });
});
