// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NarratorRow } from "@/components/features/narrators/narrator-row";
import { Table, TableBody } from "@/components/ui/table";
import type { RowState } from "@/hooks/row-animation";
import type { NarratorListItem } from "@/lib/repositories/narrator-repository";

const NARRATOR = {
  id: "n-1",
  name: "Ana",
  chaptersCount: 2,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as unknown as NarratorListItem;

function renderRow(props?: { rowState?: RowState; onRowAnimationEnd?: () => void }) {
  render(
    <Table>
      <TableBody>
        <NarratorRow
          narrator={NARRATOR}
          rowState={props?.rowState}
          onRowAnimationEnd={props?.onRowAnimationEnd}
        />
      </TableBody>
    </Table>,
  );
  return screen.getByTestId("narrator-row");
}

describe("NarratorRow — enter animation", () => {
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

  it("applies the exit animation class and data-row-state when exiting", () => {
    const row = renderRow({ rowState: "exiting" });

    expect(row.getAttribute("data-row-state")).toBe("exiting");
    expect(row.className).toContain("animate-out");
    expect(row.className).not.toContain("animate-in");
  });
});
