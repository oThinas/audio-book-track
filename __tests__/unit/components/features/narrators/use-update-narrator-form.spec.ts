// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { jsonResponse } from "@tests/helpers/fetch-response";
import { buildNarrator } from "@tests/helpers/seed-objects";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdateNarratorForm } from "@/components/features/narrators/hooks/use-update-narrator-form";
import type { NarratorFormValues } from "@/lib/domain/narrator";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

function renderUpdateHook(
  args: { narratorId?: string; onUpdated?: ReturnType<typeof vi.fn>; onNotFound?: () => void } = {},
) {
  const onUpdated = args.onUpdated ?? vi.fn();
  return renderHook(() => {
    const form = useForm<NarratorFormValues>({ defaultValues: { name: "Old Name" } });
    const updated = useUpdateNarratorForm({
      narratorId: args.narratorId ?? "n-1",
      form,
      onUpdated,
      onNotFound: args.onNotFound,
    });
    return { form, ...updated, onUpdated };
  });
}

describe("useUpdateNarratorForm", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("on 200, calls onUpdated with the response data", async () => {
    const onUpdated = vi.fn();
    const updated = buildNarrator({ id: "n-1", name: "Renamed" });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: updated }));

    const { result } = renderUpdateHook({ onUpdated });

    await act(async () => {
      await result.current.onSubmit({ name: "Renamed" });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/narrators/n-1",
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed" }),
      }),
    );
    expect(onUpdated).toHaveBeenCalledWith(JSON.parse(JSON.stringify(updated)));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("on 422, maps detail entries to form.setError", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid",
          details: [{ field: "name", message: "Inválido" }],
        },
      }),
    );

    const { result } = renderUpdateHook();

    await act(async () => {
      await result.current.onSubmit({ name: "" });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Inválido");
  });

  it("on 409, marks the name field with a PT-BR message", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: { code: "NAME_ALREADY_IN_USE", message: "X" } }),
    );

    const { result } = renderUpdateHook();

    await act(async () => {
      await result.current.onSubmit({ name: "Dup" });
    });

    expect(result.current.form.getFieldState("name").error?.message).toBe("Nome já cadastrado");
  });

  it("on 404, fires toast.error and invokes onNotFound", async () => {
    const onNotFound = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(404, { error: { code: "NOT_FOUND", message: "x" } }),
    );

    const { result } = renderUpdateHook({ onNotFound });

    await act(async () => {
      await result.current.onSubmit({ name: "Anything" });
    });

    expect(toast.error).toHaveBeenCalledWith("Narrador não existe mais.");
    expect(onNotFound).toHaveBeenCalledTimes(1);
  });

  it("on 500, fires generic toast.error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(500, { error: { code: "INTERNAL", message: "boom" } }),
    );

    const { result } = renderUpdateHook();

    await act(async () => {
      await result.current.onSubmit({ name: "Anything" });
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível atualizar o narrador. Tente novamente.",
    );
  });

  it("never calls toast.success in any branch", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: buildNarrator() }));

    const { result } = renderUpdateHook();

    await act(async () => {
      await result.current.onSubmit({ name: "Whatever" });
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
