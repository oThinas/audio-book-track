// @vitest-environment jsdom
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChapterRow, type ChapterRowEntity } from "@/components/features/chapters/chapter-row";
import { Table, TableBody } from "@/components/ui/table";
import type { FocusWeekContext } from "@/lib/domain/chapter-deadline";

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

const FOCUS: FocusWeekContext = {
  todayIso: "2026-06-10",
  mondayIso: "2026-06-08",
  sundayIso: "2026-06-14",
};

function renderRow(overrides?: Partial<ChapterRowEntity>, props?: { isSelectionMode?: boolean }) {
  const chapter: ChapterRowEntity = { ...CHAPTER, ...overrides };
  render(
    <DndContext>
      <SortableContext items={[chapter.id]}>
        <Table>
          <TableBody>
            <ChapterRow
              chapter={chapter}
              narrators={[{ id: "n-1", name: "Ana" }]}
              editors={[{ id: "e-1", name: "Bia" }]}
              narratorNameById={new Map([["n-1", "Ana"]])}
              editorNameById={new Map([["e-1", "Bia"]])}
              isLastNonPaid={false}
              isSelectionMode={props?.isSelectionMode ?? false}
              isSelected={false}
              isFirst
              isLast
              canReorder
              focusContext={FOCUS}
              onSaved={vi.fn()}
              onDeleted={vi.fn()}
              onToggleSelected={vi.fn()}
              onMoveBy={vi.fn()}
            />
          </TableBody>
        </Table>
      </SortableContext>
    </DndContext>,
  );
  return chapter;
}

function rowMode(id: string): string | null {
  return screen.getByTestId(`chapter-row-${id}`).getAttribute("data-mode");
}

describe("ChapterRow — double-click to edit", () => {
  it("double-clicking the Status cell enters edit mode and opens the status dropdown", async () => {
    const user = userEvent.setup();
    const chapter = renderRow();
    expect(rowMode(chapter.id)).toBe("view");

    await user.dblClick(screen.getByTestId(`chapter-cell-status-${chapter.id}`));

    expect(rowMode(chapter.id)).toBe("edit");
    // The status Select opens on mount (defaultOpen) → its options render.
    expect(await screen.findByRole("option", { name: "Pendente" })).toBeTruthy();
  });

  it("clicking the pencil enters edit mode without auto-opening any control", async () => {
    const user = userEvent.setup();
    const chapter = renderRow();
    await user.click(screen.getByTestId(`chapter-edit-${chapter.id}`));
    expect(rowMode(chapter.id)).toBe("edit");
    // Pencil entry leaves activateField null → no dropdown opens.
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("double-clicking the Título cell enters edit mode and focuses the title input", async () => {
    const user = userEvent.setup();
    const chapter = renderRow();
    await user.dblClick(screen.getByTestId(`chapter-cell-title-${chapter.id}`));
    expect(rowMode(chapter.id)).toBe("edit");
    expect(screen.getByTestId(`chapter-title-${chapter.id}`)).toBe(document.activeElement);
  });

  it("double-clicking the Narrador cell enters edit mode and opens the narrator dropdown", async () => {
    const user = userEvent.setup();
    const chapter = renderRow();
    await user.dblClick(screen.getByTestId(`chapter-cell-narrator-${chapter.id}`));
    expect(rowMode(chapter.id)).toBe("edit");
    expect(await screen.findByRole("option", { name: "Ana" })).toBeTruthy();
  });

  it("double-clicking the Editor cell enters edit mode and opens the editor dropdown", async () => {
    const user = userEvent.setup();
    const chapter = renderRow();
    await user.dblClick(screen.getByTestId(`chapter-cell-editor-${chapter.id}`));
    expect(rowMode(chapter.id)).toBe("edit");
    expect(await screen.findByRole("option", { name: "Bia" })).toBeTruthy();
  });

  it("double-clicking the Prazo cell enters edit mode and opens the deadline popover", async () => {
    const user = userEvent.setup();
    const chapter = renderRow();
    await user.dblClick(screen.getByTestId(`chapter-cell-deadline-${chapter.id}`));
    expect(rowMode(chapter.id)).toBe("edit");
    expect(await screen.findByRole("button", { name: "Limpar" })).toBeTruthy();
  });

  it("double-clicking the Horas cell enters edit mode and focuses the hours input", async () => {
    const user = userEvent.setup();
    const chapter = renderRow();
    await user.dblClick(screen.getByTestId(`chapter-cell-editedSeconds-${chapter.id}`));
    expect(rowMode(chapter.id)).toBe("edit");
    expect(screen.getByTestId(`chapter-hours-${chapter.id}`)).toBe(document.activeElement);
  });
});

describe("ChapterRow — cells that must not trigger edit", () => {
  it("double-clicking the drag handle does not enter edit mode", async () => {
    const user = userEvent.setup();
    const chapter = renderRow();
    await user.dblClick(screen.getByTestId(`chapter-drag-${chapter.id}`));
    expect(rowMode(chapter.id)).toBe("view");
  });

  it("double-clicking a data cell is a no-op in selection mode (FR-006)", async () => {
    const user = userEvent.setup();
    const chapter = renderRow(undefined, { isSelectionMode: true });
    await user.dblClick(screen.getByTestId(`chapter-cell-status-${chapter.id}`));
    expect(rowMode(chapter.id)).toBe("view");
  });
});
