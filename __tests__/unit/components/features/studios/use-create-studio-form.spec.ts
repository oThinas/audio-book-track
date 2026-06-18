// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { buildStudio } from "@tests/helpers/seed";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateStudioForm } from "@/components/features/studios/hooks/use-create-studio-form";
import type { StudioFormValues } from "@/lib/domain/studio";

vi.mock("@/lib/api/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@/lib/api/api-fetch");

function renderCreateHook(onCreated = vi.fn()) {
  return renderHook(() => {
    const form = useForm<StudioFormValues>({
      defaultValues: { name: "", defaultHourlyRateCents: 0 },
    });
    const created = useCreateStudioForm({ form, onCreated });
    return { form, ...created, onCreated };
  });
}

describe("useCreateStudioForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes firstFieldRef for autofocus on mount", () => {
    const { result } = renderCreateHook();
    expect(result.current.firstFieldRef).toBeDefined();
    expect(result.current.firstFieldRef.current).toBeNull();
  });

  it("on success, calls onCreated with the response data", async () => {
    const onCreated = vi.fn();
    const created = buildStudio({ id: "new", name: "Brand New" });
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      data: { data: created },
      headers: new Headers(),
    });

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({
        name: "Brand New",
        defaultHourlyRateCents: 8000,
      });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/studios",
      expect.objectContaining({
        method: "POST",
        body: { name: "Brand New", defaultHourlyRateCents: 8000 },
      }),
    );
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it("on field-errors, maps issues to form.setError", async () => {
    const onCreated = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "field-errors",
      fields: { name: "Nome obrigatório", defaultHourlyRateCents: "Valor inválido" },
    });

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({ name: "", defaultHourlyRateCents: 0 });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome obrigatório");
    expect(result.current.form.getFieldState("defaultHourlyRateCents").error?.message).toBe(
      "Valor inválido",
    );
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("on NAME_ALREADY_IN_USE api-error, sets the name field message", async () => {
    const onCreated = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "NAME_ALREADY_IN_USE",
    });

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({
        name: "Duplicate",
        defaultHourlyRateCents: 1000,
      });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome já cadastrado.");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("on generic api-error, hook does not set field errors and does not call onCreated", async () => {
    const onCreated = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "INTERNAL_ERROR",
    });

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({
        name: "Anything",
        defaultHourlyRateCents: 1000,
      });
    });

    expect(onCreated).not.toHaveBeenCalled();
    expect(result.current.form.getFieldState("name").error).toBeUndefined();
  });
});
