// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { buildStudio } from "@tests/helpers/seed";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdateStudioForm } from "@/components/features/studios/hooks/use-update-studio-form";
import type { StudioFormValues } from "@/lib/domain/studio";

vi.mock("@/lib/api/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@/lib/api/api-fetch");

function renderUpdateHook(studioId = "s-1", onUpdated = vi.fn(), onNotFound = vi.fn()) {
  return renderHook(() => {
    const form = useForm<StudioFormValues>({
      defaultValues: { name: "Old", defaultHourlyRateCents: 8000 },
    });
    const update = useUpdateStudioForm({ studioId, form, onUpdated, onNotFound });
    return { form, ...update, onUpdated, onNotFound };
  });
}

describe("useUpdateStudioForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes firstFieldRef for autofocus on mount", () => {
    const { result } = renderUpdateHook();
    expect(result.current.firstFieldRef).toBeDefined();
    expect(result.current.firstFieldRef.current).toBeNull();
  });

  it("on success, calls onUpdated with the response data", async () => {
    const onUpdated = vi.fn();
    const updated = buildStudio({ id: "s-1", name: "Updated Name" });
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: true, data: { data: updated } });

    const { result } = renderUpdateHook("s-1", onUpdated);

    await act(async () => {
      await result.current.onSubmit({
        name: "Updated Name",
        defaultHourlyRateCents: 9000,
      });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/studios/s-1",
      expect.objectContaining({
        method: "PATCH",
        body: { name: "Updated Name", defaultHourlyRateCents: 9000 },
      }),
    );
    expect(onUpdated).toHaveBeenCalledWith(updated);
  });

  it("on field-errors, calls form.setError per field", async () => {
    const onUpdated = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "field-errors",
      fields: { name: "Nome obrigatório", defaultHourlyRateCents: "Valor inválido" },
    });

    const { result } = renderUpdateHook("s-1", onUpdated);

    await act(async () => {
      await result.current.onSubmit({ name: "", defaultHourlyRateCents: 0 });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome obrigatório");
    expect(result.current.form.getFieldState("defaultHourlyRateCents").error?.message).toBe(
      "Valor inválido",
    );
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("on NAME_ALREADY_IN_USE api-error, marks the name field", async () => {
    const onUpdated = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "NAME_ALREADY_IN_USE",
    });

    const { result } = renderUpdateHook("s-1", onUpdated);

    await act(async () => {
      await result.current.onSubmit({
        name: "Duplicate",
        defaultHourlyRateCents: 9000,
      });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome já cadastrado.");
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("on STUDIO_NOT_FOUND api-error, calls onNotFound", async () => {
    const onUpdated = vi.fn();
    const onNotFound = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "STUDIO_NOT_FOUND",
    });

    const { result } = renderUpdateHook("s-1", onUpdated, onNotFound);

    await act(async () => {
      await result.current.onSubmit({ name: "x", defaultHourlyRateCents: 9000 });
    });

    expect(onNotFound).toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
  });
});
