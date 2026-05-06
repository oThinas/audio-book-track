// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { jsonResponse } from "@tests/helpers/fetch-response";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChapterRowEntity } from "@/components/features/chapters/chapter-row";
import {
  buildChapterDraft,
  type ChapterEditDraftValues,
  useChapterRowEdit,
} from "@/components/features/chapters/hooks/use-chapter-row-edit";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const NARRATOR_NAMES = new Map([["n-1", "Narrator A"]]);
const EDITOR_NAMES = new Map([["e-1", "Editor A"]]);

function makeChapter(overrides: Partial<ChapterRowEntity> = {}): ChapterRowEntity {
  return {
    id: "c-1",
    number: 1,
    status: "pending",
    narrator: null,
    editor: null,
    editedSeconds: 0,
    ...overrides,
  };
}

function renderEditHook(chapter: ChapterRowEntity) {
  const onCancel = vi.fn();
  const onSaved = vi.fn();
  return {
    onCancel,
    onSaved,
    ...renderHook(() => {
      const form = useForm<ChapterEditDraftValues>({ defaultValues: buildChapterDraft(chapter) });
      const result = useChapterRowEdit({
        chapter,
        narratorNameById: NARRATOR_NAMES,
        editorNameById: EDITOR_NAMES,
        form,
        onCancel,
        onSaved,
      });
      return { form, ...result };
    }),
  };
}

describe("useChapterRowEdit", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("buildChapterDraft maps a chapter to its draft equivalent", () => {
    const chapter = makeChapter({
      narrator: { id: "n-1", name: "N" },
      editor: { id: "e-1", name: "E" },
      editedSeconds: 1200,
      status: "editing",
    });
    expect(buildChapterDraft(chapter)).toEqual({
      status: "editing",
      narratorId: "n-1",
      editorId: "e-1",
      editedSeconds: 1200,
    });
  });

  it("onSubmit with no diff calls onCancel and skips fetch", async () => {
    const chapter = makeChapter();
    const { result, onCancel } = renderEditHook(chapter);

    await act(async () => {
      await result.current.onSubmit(buildChapterDraft(chapter));
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it("onSubmit with diff PATCHes only changed fields", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        data: {
          id: "c-1",
          number: 1,
          status: "editing",
          narratorId: "n-1",
          editorId: null,
          editedSeconds: 0,
        },
        meta: { bookStatus: "editing" },
      }),
    );

    const chapter = makeChapter({ status: "pending" });
    const { result, onSaved } = renderEditHook(chapter);

    await act(async () => {
      await result.current.onSubmit({
        status: "editing",
        narratorId: "n-1",
        editorId: null,
        editedSeconds: 0,
      });
    });

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body) as Record<string, unknown>;
    expect(callBody).toEqual({ status: "editing", narratorId: "n-1" });
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "c-1",
        status: "editing",
        narrator: { id: "n-1", name: "Narrator A" },
        editor: null,
      }),
      "editing",
    );
  });

  it("on paid → completed transition, defers persistence to a reversion request", async () => {
    const chapter = makeChapter({ status: "paid" });
    const { result } = renderEditHook(chapter);

    await act(async () => {
      await result.current.onSubmit({
        status: "completed",
        narratorId: null,
        editorId: null,
        editedSeconds: 0,
      });
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.reversionPending).not.toBeNull();
  });

  it("confirmReversion persists the deferred draft with confirmReversion=true", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        data: {
          id: "c-1",
          number: 1,
          status: "completed",
          narratorId: null,
          editorId: null,
          editedSeconds: 0,
        },
        meta: { bookStatus: "completed" },
      }),
    );

    const chapter = makeChapter({ status: "paid" });
    const { result, onSaved } = renderEditHook(chapter);

    await act(async () => {
      await result.current.onSubmit({
        status: "completed",
        narratorId: null,
        editorId: null,
        editedSeconds: 0,
      });
    });
    await act(async () => {
      await result.current.confirmReversion();
    });

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body) as Record<string, unknown>;
    expect(callBody).toEqual({ status: "completed", confirmReversion: true });
    expect(onSaved).toHaveBeenCalled();
    expect(result.current.reversionPending).toBeNull();
  });

  it("cancelReversion clears the pending draft without fetching", async () => {
    const chapter = makeChapter({ status: "paid" });
    const { result } = renderEditHook(chapter);

    await act(async () => {
      await result.current.onSubmit({
        status: "completed",
        narratorId: null,
        editorId: null,
        editedSeconds: 0,
      });
    });
    expect(result.current.reversionPending).not.toBeNull();

    act(() => result.current.cancelReversion());
    expect(result.current.reversionPending).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("on non-ok response, fires toast.error with server message", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: { code: "X", message: "Server says no." } }),
    );

    const chapter = makeChapter();
    const { result } = renderEditHook(chapter);
    await act(async () => {
      await result.current.onSubmit({
        status: "editing",
        narratorId: "n-1",
        editorId: null,
        editedSeconds: 0,
      });
    });

    expect(toast.error).toHaveBeenCalledWith("Server says no.");
  });

  it("on network error, fires generic toast.error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));

    const chapter = makeChapter();
    const { result } = renderEditHook(chapter);
    await act(async () => {
      await result.current.onSubmit({
        status: "editing",
        narratorId: "n-1",
        editorId: null,
        editedSeconds: 0,
      });
    });

    expect(toast.error).toHaveBeenCalledWith("offline");
  });
});
