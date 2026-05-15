// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChapterRowEntity } from "@/components/features/chapters/chapter-row";
import { useChaptersReorder } from "@/components/features/chapters/hooks/use-chapters-reorder";

vi.mock("@/lib/api/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@/lib/api/api-fetch");

function makeChapter(id: string, title: string, position: number): ChapterRowEntity {
  return {
    id,
    title,
    position,
    status: "pending",
    narrator: null,
    editor: null,
    editedSeconds: 0,
    deadline: null,
  };
}

describe("useChaptersReorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aplica nova ordem otimisticamente antes da resposta do servidor", async () => {
    let resolveFetch: ((value: unknown) => void) | undefined;
    vi.mocked(apiFetch).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }) as ReturnType<typeof apiFetch>,
    );

    const chapters = [makeChapter("a", "A", 0), makeChapter("b", "B", 1), makeChapter("c", "C", 2)];
    const { result } = renderHook(() =>
      useChaptersReorder({
        bookId: "book-1",
        chapters,
        initialChaptersVersion: 0,
      }),
    );

    act(() => {
      void result.current.apply(["c", "a", "b"]);
    });

    // Otimista: ordem já está aplicada antes de resolver.
    expect(result.current.orderedChapters.map((c) => c.id)).toEqual(["c", "a", "b"]);

    // Resolve sucesso.
    await act(async () => {
      resolveFetch?.({
        ok: true,
        data: { data: { chaptersVersion: 1 } },
        headers: new Headers(),
      });
      await Promise.resolve();
    });

    expect(result.current.chaptersVersion).toBe(1);
  });

  it("reverte ordem quando apiFetch falha", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "BOOK_CHAPTERS_VERSION_CONFLICT",
    });

    const onConflict = vi.fn();
    const chapters = [makeChapter("a", "A", 0), makeChapter("b", "B", 1)];
    const { result } = renderHook(() =>
      useChaptersReorder({
        bookId: "book-1",
        chapters,
        initialChaptersVersion: 0,
        onConflict,
      }),
    );

    await act(async () => {
      await result.current.apply(["b", "a"]);
    });

    expect(result.current.orderedChapters.map((c) => c.id)).toEqual(["a", "b"]);
    expect(onConflict).toHaveBeenCalled();
  });

  it("moveBy(id, +1) move um capítulo uma posição para baixo", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      data: { data: { chaptersVersion: 1 } },
      headers: new Headers(),
    });

    const chapters = [makeChapter("a", "A", 0), makeChapter("b", "B", 1), makeChapter("c", "C", 2)];
    const { result } = renderHook(() =>
      useChaptersReorder({ bookId: "book-1", chapters, initialChaptersVersion: 0 }),
    );

    await act(async () => {
      await result.current.moveBy("a", 1);
    });

    await waitFor(() => {
      expect(result.current.orderedChapters.map((c) => c.id)).toEqual(["b", "a", "c"]);
    });
  });

  it("moveBy é no-op nas extremidades", async () => {
    const chapters = [makeChapter("a", "A", 0), makeChapter("b", "B", 1)];
    const { result } = renderHook(() =>
      useChaptersReorder({ bookId: "book-1", chapters, initialChaptersVersion: 0 }),
    );

    await act(async () => {
      await result.current.moveBy("a", -1);
    });

    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.current.orderedChapters.map((c) => c.id)).toEqual(["a", "b"]);
  });
});
