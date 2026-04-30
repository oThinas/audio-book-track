// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { jsonResponse } from "@tests/helpers/fetch-response";
import { buildStudio } from "@tests/helpers/seed-objects";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateStudioForm } from "@/components/features/studios/hooks/use-create-studio-form";
import type { StudioFormValues } from "@/lib/domain/studio";

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
    const form = useForm<StudioFormValues>({
      defaultValues: { name: "", defaultHourlyRateCents: 0 },
    });
    const created = useCreateStudioForm({ form, onCreated });
    return { form, ...created, onCreated };
  });
}

describe("useCreateStudioForm", () => {
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
    const created = buildStudio({ id: "new", name: "Brand New" });
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { data: created }));

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({
        name: "Brand New",
        defaultHourlyRateCents: 8000,
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/studios",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Brand New", defaultHourlyRateCents: 8000 }),
      }),
    );
    // JSON roundtrip turns Date → ISO string; the hook does not deserialize.
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
          details: [
            { field: "name", message: "Nome obrigatório" },
            { field: "defaultHourlyRateCents", message: "Valor inválido" },
          ],
        },
      }),
    );

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({ name: "", defaultHourlyRateCents: 0 });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome obrigatório");
    expect(result.current.form.getFieldState("defaultHourlyRateCents").error?.message).toBe(
      "Valor inválido",
    );
    expect(onCreated).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("on 409 NAME_ALREADY_IN_USE, marks the name field with a PT-BR message", async () => {
    const onCreated = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, {
        error: { code: "NAME_ALREADY_IN_USE", message: "Já existe" },
      }),
    );

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({
        name: "Duplicate",
        defaultHourlyRateCents: 1000,
      });
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
      await result.current.onSubmit({
        name: "Anything",
        defaultHourlyRateCents: 1000,
      });
    });

    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar o estúdio. Tente novamente.");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("never calls toast.success in any branch", async () => {
    const onCreated = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { data: buildStudio() }));

    const { result } = renderCreateHook(onCreated);

    await act(async () => {
      await result.current.onSubmit({
        name: "Anything",
        defaultHourlyRateCents: 1000,
      });
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
