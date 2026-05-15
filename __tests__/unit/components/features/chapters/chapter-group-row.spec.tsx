// @vitest-environment jsdom
import type { Row } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChapterGroupRow } from "@/components/features/chapters/chapter-group-row";
import type { ChapterRowEntity } from "@/components/features/chapters/chapter-row";
import { Table, TableBody } from "@/components/ui/table";
import { type GroupingDimension, UNASSIGNED_GROUP_KEY } from "@/lib/url/grouping-param";

interface BuildRowOptions {
  readonly groupingDimension: GroupingDimension;
  readonly groupKey: string;
  readonly editedSeconds: number;
  readonly earningsCents: number;
  readonly subRowsCount: number;
  readonly statusBreakdown?: Record<string, number>;
  readonly firstLeaf?: ChapterRowEntity;
}

function buildRow(opts: BuildRowOptions): Row<ChapterRowEntity> {
  const breakdown = opts.statusBreakdown ?? {
    pending: 0,
    editing: 0,
    reviewing: 0,
    retake: 0,
    completed: 0,
    paid: 0,
  };
  const values: Record<string, unknown> = {
    editedSeconds: opts.editedSeconds,
    earnings: opts.earningsCents,
    statusBreakdown: breakdown,
  };
  const subRows = opts.firstLeaf ? [{ original: opts.firstLeaf } as Row<ChapterRowEntity>] : [];
  const groupingValues: Record<string, unknown> = { [opts.groupingDimension]: opts.groupKey };
  return {
    id: "group-1",
    depth: 0,
    subRows: Array.from({ length: opts.subRowsCount }, () => subRows[0] ?? null).filter(
      Boolean,
    ) as Row<ChapterRowEntity>[],
    getIsGrouped: () => true,
    getIsExpanded: () => false,
    getToggleExpandedHandler: () => vi.fn(),
    getValue: (key: string) => values[key],
    getGroupingValue: (col: string) => groupingValues[col],
  } as unknown as Row<ChapterRowEntity>;
}

function wrap(children: React.ReactNode) {
  return (
    <Table>
      <TableBody>{children}</TableBody>
    </Table>
  );
}

describe("ChapterGroupRow", () => {
  it('renders "Sem atribuição" label when group key is UNASSIGNED_GROUP_KEY', () => {
    const row = buildRow({
      groupingDimension: "narrator",
      groupKey: UNASSIGNED_GROUP_KEY,
      editedSeconds: 0,
      earningsCents: 0,
      subRowsCount: 2,
    });
    render(
      wrap(
        <ChapterGroupRow
          row={row}
          groupingDimension="narrator"
          columnCount={7}
          selectionMode={false}
          isExpanded={false}
          onToggle={() => {}}
        />,
      ),
    );
    expect(screen.getByText("Sem atribuição")).toBeTruthy();
  });

  it("renders narrator name from first leaf when group key is a real id", () => {
    const row = buildRow({
      groupingDimension: "narrator",
      groupKey: "abc-narrator",
      editedSeconds: 3600,
      earningsCents: 5000,
      subRowsCount: 3,
      firstLeaf: {
        id: "c1",
        title: "Capítulo 1",
        position: 0,
        status: "completed",
        narrator: { id: "abc-narrator", name: "Ana Silva" },
        editor: null,
        editedSeconds: 1200,
        deadline: null,
      },
    });
    render(
      wrap(
        <ChapterGroupRow
          row={row}
          groupingDimension="narrator"
          columnCount={7}
          selectionMode={false}
          isExpanded={false}
          onToggle={() => {}}
        />,
      ),
    );
    expect(screen.getByText("Ana Silva")).toBeTruthy();
  });

  it("shows earnings cell formatted in BRL", () => {
    const row = buildRow({
      groupingDimension: "editor",
      groupKey: "ed-1",
      editedSeconds: 3600,
      earningsCents: 12_345,
      subRowsCount: 1,
      firstLeaf: {
        id: "c1",
        title: "Capítulo 1",
        position: 0,
        status: "completed",
        narrator: null,
        editor: { id: "ed-1", name: "Carlos" },
        editedSeconds: 3600,
        deadline: null,
      },
    });
    render(
      wrap(
        <ChapterGroupRow
          row={row}
          groupingDimension="editor"
          columnCount={7}
          selectionMode={false}
          isExpanded={false}
          onToggle={() => {}}
        />,
      ),
    );
    const cell = screen.getByTestId("chapter-group-earnings-ed-1");
    expect(cell.textContent).toContain("R$");
    expect(cell.textContent).toContain("123,45");
  });

  it("formats edited duration as Xh Ymin (FR-005 mixed case)", () => {
    const row = buildRow({
      groupingDimension: "editor",
      groupKey: "ed-2",
      editedSeconds: 5040, // 1h 24min
      earningsCents: 0,
      subRowsCount: 1,
      firstLeaf: {
        id: "c1",
        title: "Capítulo 1",
        position: 0,
        status: "completed",
        narrator: null,
        editor: { id: "ed-2", name: "Diana" },
        editedSeconds: 5040,
        deadline: null,
      },
    });
    render(
      wrap(
        <ChapterGroupRow
          row={row}
          groupingDimension="editor"
          columnCount={7}
          selectionMode={false}
          isExpanded={false}
          onToggle={() => {}}
        />,
      ),
    );
    expect(screen.getByTestId("chapter-group-seconds-ed-2").textContent).toBe("1h 24min");
  });

  it("collapses breakdown to count when grouping by status (FR-015)", () => {
    const row = buildRow({
      groupingDimension: "status",
      groupKey: "completed",
      editedSeconds: 7200,
      earningsCents: 1000,
      subRowsCount: 3,
      statusBreakdown: {
        pending: 0,
        editing: 0,
        reviewing: 0,
        retake: 0,
        completed: 3,
        paid: 0,
      },
    });
    render(
      wrap(
        <ChapterGroupRow
          row={row}
          groupingDimension="status"
          columnCount={7}
          selectionMode={false}
          isExpanded={false}
          onToggle={() => {}}
        />,
      ),
    );
    expect(screen.getByTestId("chapter-group-breakdown-completed").textContent).toContain(
      "3 capítulos",
    );
  });

  it("lists status breakdown when grouping by narrator/editor", () => {
    const row = buildRow({
      groupingDimension: "narrator",
      groupKey: "narr-x",
      editedSeconds: 7200,
      earningsCents: 1000,
      subRowsCount: 4,
      statusBreakdown: {
        pending: 0,
        editing: 0,
        reviewing: 1,
        retake: 0,
        completed: 3,
        paid: 0,
      },
      firstLeaf: {
        id: "c1",
        title: "Capítulo 1",
        position: 0,
        status: "completed",
        narrator: { id: "narr-x", name: "Eduarda" },
        editor: null,
        editedSeconds: 1800,
        deadline: null,
      },
    });
    render(
      wrap(
        <ChapterGroupRow
          row={row}
          groupingDimension="narrator"
          columnCount={7}
          selectionMode={false}
          isExpanded={false}
          onToggle={() => {}}
        />,
      ),
    );
    const breakdown = screen.getByTestId("chapter-group-breakdown-narr-x");
    expect(breakdown.textContent).toContain("em revisão");
    expect(breakdown.textContent).toContain("concluído");
  });
});
