// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { jsonResponse } from "@tests/helpers/fetch-response";
import { buildStudio } from "@tests/helpers/seed-objects";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdateStudioForm } from "@/components/features/studios/hooks/use-update-studio-form";
import type { StudioFormValues } from "@/lib/domain/studio";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

function renderUpdateHook(studioId = "s-1", onUpdated = vi.fn()) {
  return renderHook(() => {
    const form = useForm<StudioFormValues>({
      defaultValues: { name: "Old", defaultHourlyRateCents: 8000 },
    });
    const update = useUpdateStudioForm({ studioId, form, onUpdated });
    return { form, ...update, onUpdated };
  });
}

describe("useUpdateStudioForm", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("exposes firstFieldRef for autofocus on mount", () => {
    const { result } = renderUpdateHook();
    expect(result.current.firstFieldRef).toBeDefined();
    expect(result.current.firstFieldRef.current).toBeNull();
  });

  it("on 200, calls onUpdated with the response data and never toast.success", async () => {
    const onUpdated = vi.fn();
    const updated = buildStudio({ id: "s-1", name: "Updated Name" });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: updated }));

    const { result } = renderUpdateHook("s-1", onUpdated);

    await act(async () => {
      await result.current.onSubmit({
        name: "Updated Name",
        defaultHourlyRateCents: 9000,
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/studios/s-1",
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name", defaultHourlyRateCents: 9000 }),
      }),
    );
    // JSON roundtrip turns Date → ISO string; the hook does not deserialize.
    expect(onUpdated).toHaveBeenCalledWith(JSON.parse(JSON.stringify(updated)));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("on 422, calls form.setError per detail.field", async () => {
    const onUpdated = vi.fn();
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

    const { result } = renderUpdateHook("s-1", onUpdated);

    await act(async () => {
      await result.current.onSubmit({ name: "", defaultHourlyRateCents: 0 });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome obrigatório");
    expect(result.current.form.getFieldState("defaultHourlyRateCents").error?.message).toBe(
      "Valor inválido",
    );
    expect(onUpdated).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("on 409 NAME_ALREADY_IN_USE, marks the name field with a PT-BR message", async () => {
    const onUpdated = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, {
        error: { code: "NAME_ALREADY_IN_USE", message: "Já existe" },
      }),
    );

    const { result } = renderUpdateHook("s-1", onUpdated);

    await act(async () => {
      await result.current.onSubmit({
        name: "Duplicate",
        defaultHourlyRateCents: 9000,
      });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome já cadastrado");
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("on 500, fires toast.error", async () => {
    const onUpdated = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(500, { error: { code: "INTERNAL", message: "boom" } }),
    );

    const { result } = renderUpdateHook("s-1", onUpdated);

    await act(async () => {
      await result.current.onSubmit({
        name: "Anything",
        defaultHourlyRateCents: 9000,
      });
    });

    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar o estúdio. Tente novamente.");
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("never calls toast.success in any branch", async () => {
    const onUpdated = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: buildStudio() }));

    const { result } = renderUpdateHook("s-1", onUpdated);

    await act(async () => {
      await result.current.onSubmit({
        name: "Anything",
        defaultHourlyRateCents: 9000,
      });
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
