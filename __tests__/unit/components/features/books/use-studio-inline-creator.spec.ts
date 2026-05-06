// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { jsonResponse } from "@tests/helpers/fetch-response";
import { buildStudio } from "@tests/helpers/seed";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStudioInlineCreator } from "@/components/features/books/hooks/use-studio-inline-creator";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

describe("useStudioInlineCreator", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
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

  it("on 201, calls onCreated with response data and POSTs the inline payload", async () => {
    const onCreated = vi.fn();
    const created = buildStudio({ id: "new", name: "New Studio" });
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, { data: created, meta: { reactivated: false } }),
    );

    const { result } = renderHook(() => useStudioInlineCreator({ onCreated, onCancel: vi.fn() }));
    act(() => result.current.setName("New Studio"));

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/studios",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "New Studio",
          defaultHourlyRateCents: 1,
          inline: true,
        }),
      }),
    );
    expect(onCreated).toHaveBeenCalledWith(JSON.parse(JSON.stringify(created)));
  });

  it("on 409, sets local error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: { code: "NAME_ALREADY_IN_USE", message: "X" } }),
    );

    const { result } = renderHook(() =>
      useStudioInlineCreator({ onCreated: vi.fn(), onCancel: vi.fn() }),
    );
    act(() => result.current.setName("Dup"));

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.error).toBe("Já existe um estúdio com este nome.");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("clears error when user types after error appears", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, { error: { code: "VALIDATION_ERROR", message: "x", details: [] } }),
    );

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
