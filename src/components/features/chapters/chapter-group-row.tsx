"use client";

import type { Row } from "@tanstack/react-table";
import { ChevronDown } from "lucide-react";

import { StatusBadge } from "@/components/features/books/status-badge";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ChapterStatus } from "@/lib/domain/chapter";
import { formatStatusBreakdown, type StatusBreakdown } from "@/lib/domain/chapter-aggregation";
import { type GroupingDimension, UNASSIGNED_GROUP_KEY } from "@/lib/url/grouping-param";
import { formatCentsBRL, formatGroupedSeconds } from "@/lib/utils";

import type { ChapterRowEntity } from "./chapter-row";

export interface ChapterGroupRowProps {
  readonly row: Row<ChapterRowEntity>;
  readonly groupingDimension: GroupingDimension;
  readonly columnCount: number;
  /** Empty leading column to preserve layout when selection mode is active. */
  readonly selectionMode: boolean;
}

function indentStyle(depth: number): React.CSSProperties {
  return { paddingLeft: `${0.75 + depth * 1.25}rem` };
}

function groupLabel(row: Row<ChapterRowEntity>, dimension: GroupingDimension): React.ReactNode {
  const value = row.getGroupingValue(dimension);
  if (dimension === "status") {
    return <StatusBadge status={value as ChapterStatus} />;
  }
  if (value === UNASSIGNED_GROUP_KEY || value === null || value === undefined) {
    return <span className="italic text-muted-foreground">Sem atribuição</span>;
  }
  // Pick the name from the first leaf — every leaf in the same group shares the entity.
  const firstLeaf = row.subRows[0]?.original;
  const name =
    dimension === "narrator"
      ? firstLeaf?.narrator?.name
      : dimension === "editor"
        ? firstLeaf?.editor?.name
        : null;
  return <span className="font-medium">{name ?? "—"}</span>;
}

function countLabel(count: number): string {
  return count === 1 ? "1 capítulo" : `${count} capítulos`;
}

export function ChapterGroupRow({
  row,
  groupingDimension,
  columnCount: _columnCount,
  selectionMode,
}: ChapterGroupRowProps) {
  const editedSeconds = (row.getValue("editedSeconds") as number) ?? 0;
  const earningsCents = (row.getValue("earnings") as number) ?? 0;
  const breakdown = (row.getValue("statusBreakdown") as StatusBreakdown | undefined) ?? {
    pending: 0,
    editing: 0,
    reviewing: 0,
    retake: 0,
    completed: 0,
    paid: 0,
  };
  const breakdownText = formatStatusBreakdown(breakdown, groupingDimension);
  const groupKey = String(row.getGroupingValue(groupingDimension) ?? "unknown");

  return (
    <TableRow
      data-testid={`chapter-group-row-${groupingDimension}-${groupKey}`}
      className="bg-muted/40 hover:bg-muted/60"
    >
      {selectionMode && <TableCell className="w-12" />}
      <TableCell colSpan={2} className="font-medium" style={indentStyle(row.depth)}>
        <div
          className="-ml-2 inline-flex h-7 items-center gap-1.5 px-2"
          data-testid={`chapter-group-toggle-${groupKey}`}
        >
          <ChevronDown aria-hidden="true" className="size-3.5 opacity-60" />
          {groupLabel(row, groupingDimension)}
        </div>
      </TableCell>
      <TableCell
        className="truncate text-sm text-muted-foreground"
        data-testid={`chapter-group-count-${groupKey}`}
      >
        {countLabel(row.subRows.length)}
      </TableCell>
      <TableCell
        className="truncate text-sm text-muted-foreground"
        data-testid={`chapter-group-breakdown-${groupKey}`}
      >
        {breakdownText || (groupingDimension === "status" ? countLabel(row.subRows.length) : "—")}
        <span
          data-testid={`chapter-group-earnings-${groupKey}`}
          className="ml-2 text-foreground"
          title={`Ganho total: ${formatCentsBRL(earningsCents)}`}
        >
          · {formatCentsBRL(earningsCents)}
        </span>
      </TableCell>
      <TableCell
        className="text-right tabular-nums"
        data-testid={`chapter-group-seconds-${groupKey}`}
      >
        {formatGroupedSeconds(editedSeconds)}
      </TableCell>
      <TableCell />
    </TableRow>
  );
}
