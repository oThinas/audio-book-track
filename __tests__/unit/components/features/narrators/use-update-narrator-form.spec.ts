// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { buildNarrator } from "@tests/helpers/seed";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdateNarratorForm } from "@/components/features/narrators/hooks/use-update-narrator-form";
import type { NarratorFormValues } from "@/lib/domain/narrator";

vi.mock("@/lib/api/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@/lib/api/api-fetch");

function renderUpdateHook(narratorId = "n-1", onUpdated = vi.fn(), onNotFound = vi.fn()) {
  return renderHook(() => {
    const form = useForm<NarratorFormValues>({ defaultValues: { name: "Old" } });
    const update = useUpdateNarratorForm({ narratorId, form, onUpdated, onNotFound });
    return { form, ...update, onUpdated, onNotFound };
  });
}

describe("useUpdateNarratorForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("on success, calls onUpdated with the response data", async () => {
    const onUpdated = vi.fn();
    const updated = buildNarrator({ id: "n-1", name: "Updated" });
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: true, data: { data: updated } });

    const { result } = renderUpdateHook("n-1", onUpdated);

    await act(async () => {
      await result.current.onSubmit({ name: "Updated" });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/narrators/n-1",
      expect.objectContaining({ method: "PATCH", body: { name: "Updated" } }),
    );
    expect(onUpdated).toHaveBeenCalledWith(updated);
  });

  it("on field-errors, calls form.setError", async () => {
    const onUpdated = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "field-errors",
      fields: { name: "Nome obrigatório" },
    });

    const { result } = renderUpdateHook("n-1", onUpdated);

    await act(async () => {
      await result.current.onSubmit({ name: "" });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome obrigatório");
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("on NAME_ALREADY_IN_USE api-error, marks the name field", async () => {
    const onUpdated = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "NAME_ALREADY_IN_USE",
    });

    const { result } = renderUpdateHook("n-1", onUpdated);

    await act(async () => {
      await result.current.onSubmit({ name: "Duplicate" });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome já cadastrado.");
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("on NARRATOR_NOT_FOUND api-error, calls onNotFound", async () => {
    const onUpdated = vi.fn();
    const onNotFound = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "NARRATOR_NOT_FOUND",
    });

    const { result } = renderUpdateHook("n-1", onUpdated, onNotFound);

    await act(async () => {
      await result.current.onSubmit({ name: "x" });
    });

    expect(onNotFound).toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
  });
});
