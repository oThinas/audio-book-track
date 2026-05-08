// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { buildStudio } from "@tests/helpers/seed";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStudioInlineCreator } from "@/components/features/books/hooks/use-studio-inline-creator";

vi.mock("@/lib/api/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@/lib/api/api-fetch");

function successResult(data: unknown) {
  return { ok: true as const, data, headers: new Headers() };
}

describe("useStudioInlineCreator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts disabled (canSubmit=false) when name is empty", () => {
    const { result } = renderHook(() =>
      useStudioInlineCreator({ onCreated: vi.fn(), onCancel: vi.fn() }),
    );
    expect(result.current.canSubmit).toBe(false);
    expect(result.current.submitting).toBe(false);
  });

  it("becomes submittable when name has 2+ chars", () => {
    const { result } = renderHook(() =>
      useStudioInlineCreator({ onCreated: vi.fn(), onCancel: vi.fn() }),
    );
    act(() => result.current.setName("Ab"));
    expect(result.current.canSubmit).toBe(true);
  });

  it("on success, calls onCreated with response data and POSTs the inline payload", async () => {
    const onCreated = vi.fn();
    const created = buildStudio({ id: "new", name: "New Studio" });
    vi.mocked(apiFetch).mockResolvedValueOnce(
      successResult({ data: created, meta: { reactivated: false } }),
    );

    const { result } = renderHook(() => useStudioInlineCreator({ onCreated, onCancel: vi.fn() }));
    act(() => result.current.setName("New Studio"));

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/studios",
      expect.objectContaining({
        method: "POST",
        body: { name: "New Studio", defaultHourlyRateCents: 1, inline: true },
      }),
    );
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it("on NAME_ALREADY_IN_USE api-error, sets local error", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "NAME_ALREADY_IN_USE",
    });

    const { result } = renderHook(() =>
      useStudioInlineCreator({ onCreated: vi.fn(), onCancel: vi.fn() }),
    );
    act(() => result.current.setName("Dup"));

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.error).toBe("Já existe um estúdio com este nome.");
  });

  it("on field-errors with name, sets local error from server message", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "field-errors",
      fields: { name: "Nome inválido." },
    });

    const { result } = renderHook(() =>
      useStudioInlineCreator({ onCreated: vi.fn(), onCancel: vi.fn() }),
    );
    act(() => result.current.setName("Bad"));
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.error).toBe("Nome inválido.");
  });

  it("clears local error when user types after error appears", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "field-errors",
      fields: { name: "Nome inválido." },
    });

    const { result } = renderHook(() =>
      useStudioInlineCreator({ onCreated: vi.fn(), onCancel: vi.fn() }),
    );
    act(() => result.current.setName("Bad"));
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.error).not.toBeNull();

    act(() => result.current.setName("Better"));
    expect(result.current.error).toBeNull();
  });

  it("Escape key triggers onCancel", () => {
    const onCancel = vi.fn();
    const { result } = renderHook(() => useStudioInlineCreator({ onCreated: vi.fn(), onCancel }));

    const event = {
      key: "Escape",
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLInputElement>;
    act(() => result.current.handleKeyDown(event));

    expect(onCancel).toHaveBeenCalled();
  });
});
