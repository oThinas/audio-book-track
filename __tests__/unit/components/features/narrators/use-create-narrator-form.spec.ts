// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { jsonResponse } from "@tests/helpers/fetch-response";
import { buildNarrator } from "@tests/helpers/seed-objects";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateNarratorForm } from "@/components/features/narrators/hooks/use-create-narrator-form";
import type { NarratorFormValues } from "@/lib/domain/narrator";

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
    const form = useForm<NarratorFormValues>({ defaultValues: { name: "" } });
    const created = useCreateNarratorForm({ form, onCreated });
    return { form, ...created, onCreated };
  });
}

describe("useCreateNarratorForm", () => {
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
    const created = buildNarrator({ id: "new", name: "Brand New" });
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { data: created }));

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({ name: "Brand New" });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/narrators",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Brand New" }),
      }),
    );
    expect(onCreated).toHaveBeenCalledWith(JSON.parse(JSON.stringify(created)));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("on 422, maps detail.field entries to form.setError", async () => {
    const onCreated = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid",
          details: [{ field: "name", message: "Nome obrigatório" }],
        },
      }),
    );

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({ name: "" });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome obrigatório");
    expect(onCreated).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("on 409, marks the name field with a PT-BR message", async () => {
    const onCreated = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: { code: "NAME_ALREADY_IN_USE", message: "Já existe" } }),
    );

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({ name: "Duplicate" });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome já cadastrado");
    expect(onCreated).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("on 500, fires toast.error and does not call onCreated", async () => {
    const onCreated = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(500, { error: { code: "INTERNAL", message: "boom" } }),
    );

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({ name: "Anything" });
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível salvar o narrador. Tente novamente.",
    );
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("never calls toast.success in any branch", async () => {
    const onCreated = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { data: buildNarrator() }));

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({ name: "Anything" });
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
