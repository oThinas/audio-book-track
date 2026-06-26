"use client";

import type { Row } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";

import { StatusBadge } from "@/components/features/books/status-badge";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ChapterStatus } from "@/lib/domain/chapter";
import { type GroupingDimension, UNASSIGNED_GROUP_KEY } from "@/lib/url/grouping-param";
import { formatCentsBRL, formatGroupedSeconds } from "@/lib/utils";

import type { ChapterRowEntity } from "./chapter-row";

export interface ChapterGroupRowProps {
  readonly row: Row<ChapterRowEntity>;
  readonly groupingDimension: GroupingDimension;
  readonly columnCount: number;
  /** Empty leading column to preserve layout when selection mode is active. */
  readonly selectionMode: boolean;
  readonly isExpanded: boolean;
  readonly onToggle: (rowId: string) => void;
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
  isExpanded,
  onToggle,
}: ChapterGroupRowProps) {
  const editedSeconds = (row.getValue("editedSeconds") as number) ?? 0;
  const earningsCents = (row.getValue("earnings") as number) ?? 0;
  const groupKey = String(row.getGroupingValue(groupingDimension) ?? "unknown");

  function handleKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle(row.id);
    }
  }

  // The group row maps cell-by-cell to the table header columns. With
  // `table-fixed` the indices matter: cells shift one column to the left if
  // a leading cell is missing. Layout (without selection):
  // [Title+Status colSpan=2] [Narrator: count] [Editor: earnings] [Prazo: -]
  // [Horas: total] [Ações: -].
  return (
    <TableRow
      data-testid={`chapter-group-row-${groupingDimension}-${groupKey}`}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={() => onToggle(row.id)}
      onKeyDown={handleKeyDown}
      className="cursor-pointer bg-muted/40 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {selectionMode && <TableCell className="w-12" />}
      <TableCell colSpan={2} className="font-medium" style={indentStyle(row.depth)}>
        <div className="inline-flex items-center gap-1.5">
          <ChevronRight
            aria-hidden="true"
            className={`size-3.5 opacity-60 transition-transform ${isExpanded ? "rotate-90" : ""}`}
          />
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
        className="truncate text-sm text-foreground tabular-nums"
        data-testid={`chapter-group-earnings-${groupKey}`}
        title={`Ganho total: ${formatCentsBRL(earningsCents)}`}
      >
        {formatCentsBRL(earningsCents)}
      </TableCell>
      <TableCell aria-hidden="true" />
      <TableCell
        className="text-right tabular-nums"
        data-testid={`chapter-group-seconds-${groupKey}`}
      >
        {formatGroupedSeconds(editedSeconds)}
      </TableCell>
      <TableCell aria-hidden="true" />
    </TableRow>
  );
}
