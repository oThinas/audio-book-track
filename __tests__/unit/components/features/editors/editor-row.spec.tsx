// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EditorRow } from "@/components/features/editors/editor-row";
import { Table, TableBody } from "@/components/ui/table";
import type { RowState } from "@/hooks/row-animation";
import type { EditorListItem } from "@/lib/repositories/editor-repository";

const EDITOR = {
  id: "e-1",
  name: "Bia",
  email: "bia@example.com",
  chaptersCount: 3,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as unknown as EditorListItem;

function renderRow(props?: { rowState?: RowState; onRowAnimationEnd?: () => void }) {
  render(
    <Table>
      <TableBody>
        <EditorRow
          editor={EDITOR}
          rowState={props?.rowState}
          onRowAnimationEnd={props?.onRowAnimationEnd}
        />
      </TableBody>
    </Table>,
  );
  return screen.getByTestId("editor-row");
}

describe("EditorRow — enter animation", () => {
  it("applies the enter animation class and data-row-state when entering", () => {
    const row = renderRow({ rowState: "entering" });

    expect(row.getAttribute("data-row-state")).toBe("entering");
    expect(row.className).toContain("animate-in");
  });

  it("does not apply the enter animation class when idle", () => {
    const row = renderRow({ rowState: "idle" });

    expect(row.getAttribute("data-row-state")).toBe("idle");
    expect(row.className).not.toContain("animate-in");
  });

  it("defaults to idle when no rowState is provided", () => {
    const row = renderRow();

    expect(row.getAttribute("data-row-state")).toBe("idle");
  });

  it("calls onRowAnimationEnd when the row's own animation ends", () => {
    const onRowAnimationEnd = vi.fn();
    const row = renderRow({ rowState: "entering", onRowAnimationEnd });

    fireEvent.animationEnd(row);

    expect(onRowAnimationEnd).toHaveBeenCalledTimes(1);
  });
});
