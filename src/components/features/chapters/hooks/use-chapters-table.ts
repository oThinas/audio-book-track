"use client";
"use no memo";

import {
  type ColumnDef,
  type GroupingState,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  type Row,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo } from "react";

import { sumChapterEarningsCents } from "@/lib/domain/chapter-aggregation";
import { type GroupingDimension, UNASSIGNED_GROUP_KEY } from "@/lib/url/grouping-param";

import type { ChapterRowEntity } from "../chapter-row";

export interface UseChaptersTableArgs {
  readonly chapters: ReadonlyArray<ChapterRowEntity>;
  readonly grouping: ReadonlyArray<GroupingDimension>;
  readonly pricePerHourCents: number;
}

export interface UseChaptersTableReturn {
  readonly table: ReturnType<typeof useReactTable<ChapterRowEntity>>;
}

function leafChaptersFromRow(row: Row<ChapterRowEntity>): ReadonlyArray<ChapterRowEntity> {
  return row.getLeafRows().map((leaf) => leaf.original);
}

/**
 * Configures a TanStack Table instance for the chapters table.
 *
 * - Grouping comes from the parent (URL-controlled via useChaptersGroupingState).
 * - `state.expanded` is forced to `true` so leaves flow through the row model;
 *   per-group visibility is owned by `ChaptersTable` via a `Set<string>` of
 *   expanded group ids. TanStack's own expansion state plus React 19 + the
 *   base-ui Menu portal silently dropped toggle clicks, so manual handling
 *   keeps the render path simple.
 * - The file is opted out of React Compiler (`"use no memo"`) because the
 *   compiler over-memoizes the TanStack options object and the `state.grouping`
 *   prop stops propagating when the URL changes after a dropdown click.
 */
export function useChaptersTable({
  chapters,
  grouping,
  pricePerHourCents,
}: UseChaptersTableArgs): UseChaptersTableReturn {
  const groupingArray = useMemo<GroupingState>(() => [...grouping], [grouping]);

  // When grouping by narrator or editor, push the chapters with no assignment
  // to the end so the "Sem atribuição" bucket renders last. TanStack groups
  // rows in their input order (we don't run a sorted row model), so we have
  // to massage the data before handing it to the table. Stable sort preserves
  // the user's ordering within each group.
  const orderedChapters = useMemo<ReadonlyArray<ChapterRowEntity>>(() => {
    const dim = groupingArray[0];
    if (dim !== "narrator" && dim !== "editor") return chapters;
    return [...chapters].sort((a, b) => {
      const aHas = (dim === "narrator" ? a.narrator : a.editor) !== null;
      const bHas = (dim === "narrator" ? b.narrator : b.editor) !== null;
      if (aHas === bHas) return 0;
      return aHas ? -1 : 1;
    });
  }, [chapters, groupingArray]);

  const columns = useMemo<ColumnDef<ChapterRowEntity>[]>(() => {
    const groupAwareSecondsSort = (rowA: Row<ChapterRowEntity>, rowB: Row<ChapterRowEntity>) => {
      // Push UNASSIGNED bucket to the end of its level (FR-006) — only for grouped rows
      if (rowA.getIsGrouped() && rowB.getIsGrouped()) {
        const groupColId = rowA.groupingColumnId;
        if (groupColId && groupColId === rowB.groupingColumnId) {
          const aValue = rowA.getGroupingValue(groupColId);
          const bValue = rowB.getGroupingValue(groupColId);
          const aUnassigned = aValue === UNASSIGNED_GROUP_KEY;
          const bUnassigned = bValue === UNASSIGNED_GROUP_KEY;
          if (aUnassigned && !bUnassigned) return 1;
          if (!aUnassigned && bUnassigned) return -1;
        }
      }
      const aSeconds = (rowA.getValue("editedSeconds") as number) ?? 0;
      const bSeconds = (rowB.getValue("editedSeconds") as number) ?? 0;
      return aSeconds - bSeconds;
    };

    const sumEarningsAggregation = (
      _columnId: string,
      leafRows: ReadonlyArray<Row<ChapterRowEntity>>,
    ): number => {
      const leafChapters = leafRows.map((leaf) => leaf.original);
      return sumChapterEarningsCents(leafChapters, { pricePerHourCents });
    };

    return [
      {
        id: "title",
        accessorKey: "title",
        header: "Título",
        enableGrouping: false,
        sortingFn: "basic",
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        enableGrouping: true,
        sortingFn: groupAwareSecondsSort,
      },
      {
        id: "narrator",
        accessorFn: (row) => row.narrator?.id ?? UNASSIGNED_GROUP_KEY,
        header: "Narrador",
        enableGrouping: true,
        sortingFn: groupAwareSecondsSort,
      },
      {
        id: "editor",
        accessorFn: (row) => row.editor?.id ?? UNASSIGNED_GROUP_KEY,
        header: "Editor",
        enableGrouping: true,
        sortingFn: groupAwareSecondsSort,
      },
      {
        id: "editedSeconds",
        accessorKey: "editedSeconds",
        header: "Horas editadas",
        enableGrouping: false,
        aggregationFn: "sum",
        sortingFn: groupAwareSecondsSort,
      },
      {
        id: "earnings",
        accessorFn: () => 0,
        header: "Ganho",
        enableGrouping: false,
        enableSorting: false,
        aggregationFn: sumEarningsAggregation,
      },
    ];
  }, [pricePerHourCents]);

  const table = useReactTable({
    data: orderedChapters as ChapterRowEntity[],
    columns,
    state: {
      grouping: groupingArray,
      expanded: true, // Force all groups expanded so leaves flow through the row model
    },
    onGroupingChange: () => {
      // Controlled via URL upstream — no-op here.
    },
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    enableGrouping: true,
    enableExpanding: true,
    // Pagination isn't used here. The default `autoResetPageIndex` schedules
    // `setState` during render when grouping/data changes, which warns in React
    // 19 ("state update on a component that hasn't mounted yet").
    autoResetPageIndex: false,
    autoResetExpanded: false,
  });

  return { table };
}

export { leafChaptersFromRow };
