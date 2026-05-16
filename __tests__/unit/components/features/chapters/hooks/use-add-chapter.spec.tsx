// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAddChapter } from "@/components/features/chapters/hooks/use-add-chapter";

vi.mock("@/lib/api/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@/lib/api/api-fetch");

function setup(overrides: Partial<Parameters<typeof useAddChapter>[0]> = {}) {
  const onCreated = vi.fn();
  const onConflict = vi.fn();
  const args = {
    bookId: "book-1",
    chaptersVersion: 0,
    existingTitles: ["Capítulo 1", "Capítulo 2"],
    onCreated,
    onConflict,
    ...overrides,
  };
  const rendered = renderHook(() => useAddChapter(args));
  return { ...rendered, onCreated, onConflict };
}

describe("useAddChapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usa nextChapterTitle como sugestão default", () => {
    const { result } = setup();
    expect(result.current.defaultTitle).toBe("Capítulo 3");
  });

  it("submit envia title trimado, position e expectedVersion via POST", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      data: {
        data: {
          chapter: { id: "c-new", title: "Capítulo 3", position: 2, status: "pending" },
          bookStatus: "pending",
          chaptersVersion: 1,
        },
      },
      headers: new Headers(),
    });

    const { result, onCreated } = setup();
    act(() => {
      result.current.form.setValue("title", "  Abertura  ");
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/books/book-1/chapters",
      expect.objectContaining({
        method: "POST",
        body: { title: "Abertura", position: "end", expectedVersion: 0 },
      }),
    );
    expect(onCreated).toHaveBeenCalledWith({ chaptersVersion: 1, bookStatus: "pending" });
  });

  it("409 dispara onConflict e não chama onCreated", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "BOOK_CHAPTERS_VERSION_CONFLICT",
    });

    const { result, onCreated, onConflict } = setup();
    await act(async () => {
      await result.current.onSubmit();
    });

    expect(onConflict).toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("rejeita title vazio antes de chamar apiFetch", async () => {
    const { result, onCreated } = setup();
    act(() => {
      result.current.form.setValue("title", "");
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(apiFetch).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(result.current.form.getFieldState("title").error?.message).toMatch(/[Tt]ítulo/);
    });
  });

  it("envia position={after} quando positionMode='after'", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      data: {
        data: {
          chapter: { id: "c-new", title: "X", position: 1, status: "pending" },
          bookStatus: "pending",
          chaptersVersion: 1,
        },
      },
      headers: new Headers(),
    });

    const { result } = setup();
    act(() => {
      result.current.form.setValue("kind", "custom");
      result.current.form.setValue("title", "X");
      result.current.form.setValue("positionMode", "after");
      result.current.form.setValue("afterChapterId", "ch-abc");
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/books/book-1/chapters",
      expect.objectContaining({
        body: { title: "X", position: { after: "ch-abc" }, expectedVersion: 0 },
      }),
    );
  });
});
