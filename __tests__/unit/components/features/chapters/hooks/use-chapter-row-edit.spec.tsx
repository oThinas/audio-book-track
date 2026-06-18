// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { KeyboardEvent } from "react";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChapterRowEntity } from "@/components/features/chapters/chapter-row";
import {
  buildChapterDraft,
  type ChapterEditDraftValues,
  useChapterRowEdit,
} from "@/components/features/chapters/hooks/use-chapter-row-edit";

vi.mock("@/lib/api/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@/lib/api/api-fetch");

const CHAPTER: ChapterRowEntity = {
  id: "c-1",
  title: "Capítulo 1",
  position: 0,
  status: "editing",
  narrator: null,
  editor: null,
  editedSeconds: 0,
  deadline: null,
};

function setup() {
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  const onVersionChange = vi.fn();
  const { result } = renderHook(() => {
    const form = useForm<ChapterEditDraftValues>({ defaultValues: buildChapterDraft(CHAPTER) });
    const hook = useChapterRowEdit({
      chapter: CHAPTER,
      narratorNameById: new Map(),
      editorNameById: new Map(),
      form,
      onCancel,
      onSaved,
      onVersionChange,
    });
    return { form, hook };
  });
  return { result, onSaved, onCancel, onVersionChange };
}

function makeKeyEvent(
  key: string,
  target: HTMLElement = document.createElement("input"),
): KeyboardEvent<HTMLTableRowElement> {
  return {
    key,
    preventDefault: vi.fn(),
    target,
  } as unknown as KeyboardEvent<HTMLTableRowElement>;
}

function elementWithAttr(tag: string, attr: string, value = ""): HTMLElement {
  const el = document.createElement(tag);
  el.setAttribute(attr, value);
  return el;
}

function childOf(parent: HTMLElement, tag = "div"): HTMLElement {
  const child = document.createElement(tag);
  parent.appendChild(child);
  return child;
}

describe("useChapterRowEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads meta.chaptersVersion and calls onSaved + onVersionChange", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      data: {
        data: {
          id: "c-1",
          title: "Novo título",
          position: 0,
          status: "editing",
          narratorId: null,
          editorId: null,
          editedSeconds: 0,
          deadline: null,
        },
        meta: { bookStatus: "editing", chaptersVersion: 7 },
      },
      headers: new Headers(),
    });

    const { result, onSaved, onVersionChange } = setup();
    await act(async () => {
      await result.current.hook.onSubmit({ ...buildChapterDraft(CHAPTER), title: "Novo título" });
    });

    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c-1", title: "Novo título" }),
      "editing",
    );
    expect(onVersionChange).toHaveBeenCalledWith(7);
  });

  describe("handleRowKeyDown — open-aware Enter/Escape", () => {
    it("Enter with nothing open prevents default and submits the form", async () => {
      const { result } = setup();
      const event = makeKeyEvent("Enter");
      await act(async () => {
        result.current.hook.handleRowKeyDown(event);
      });
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("Escape with nothing open prevents default and cancels", () => {
      const { result, onCancel } = setup();
      const event = makeKeyEvent("Escape");
      act(() => {
        result.current.hook.handleRowKeyDown(event);
      });
      expect(event.preventDefault).toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalled();
    });

    it("Enter returns early when the target trigger is open (aria-expanded=true)", () => {
      const { result } = setup();
      const event = makeKeyEvent("Enter", elementWithAttr("button", "aria-expanded", "true"));
      act(() => {
        result.current.hook.handleRowKeyDown(event);
      });
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("Enter returns early when focus is inside an open select popup", () => {
      const { result } = setup();
      const content = elementWithAttr("div", "data-slot", "select-content");
      const event = makeKeyEvent("Enter", childOf(content));
      act(() => {
        result.current.hook.handleRowKeyDown(event);
      });
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("Enter returns early when focus is inside an open popover popup", () => {
      const { result } = setup();
      const content = elementWithAttr("div", "data-slot", "popover-content");
      const event = makeKeyEvent("Enter", childOf(content));
      act(() => {
        result.current.hook.handleRowKeyDown(event);
      });
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("Escape returns early (no cancel) when a popup is open", () => {
      const { result, onCancel } = setup();
      const event = makeKeyEvent("Escape", elementWithAttr("button", "aria-expanded", "true"));
      act(() => {
        result.current.hook.handleRowKeyDown(event);
      });
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(onCancel).not.toHaveBeenCalled();
    });

    it("Enter on the action buttons cell keeps native behavior (no preventDefault)", () => {
      const { result } = setup();
      const cell = elementWithAttr("td", "data-row-actions");
      const event = makeKeyEvent("Enter", childOf(cell, "button"));
      act(() => {
        result.current.hook.handleRowKeyDown(event);
      });
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("ignores keys other than Enter and Escape", () => {
      const { result, onCancel } = setup();
      const event = makeKeyEvent("a");
      act(() => {
        result.current.hook.handleRowKeyDown(event);
      });
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(onCancel).not.toHaveBeenCalled();
    });

    it("does not submit again while a submit is already in flight (no double submit)", async () => {
      let release: (() => void) | undefined;
      vi.mocked(apiFetch).mockReturnValueOnce(
        new Promise((resolve) => {
          release = () => resolve({ ok: false, kind: "api-error", code: "X" });
        }),
      );

      const { result } = setup();
      // Start a submit with a real diff so apiFetch is invoked and stays pending.
      act(() => {
        result.current.form.setValue("title", "Mudou");
      });
      await act(async () => {
        result.current.hook.handleRowKeyDown(makeKeyEvent("Enter"));
        await Promise.resolve();
      });

      const second = makeKeyEvent("Enter");
      act(() => {
        result.current.hook.handleRowKeyDown(second);
      });
      expect(second.preventDefault).not.toHaveBeenCalled();
      expect(apiFetch).toHaveBeenCalledTimes(1);

      await act(async () => {
        release?.();
      });
    });
  });
});
