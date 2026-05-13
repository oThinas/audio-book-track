"use client";

import {
  type ColumnDef,
  type ExpandedState,
  type GroupingState,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  type Row,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { countByStatus, sumChapterEarningsCents } from "@/lib/domain/chapter-aggregation";
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
 * - Expanded state lives in local component state — preserved across re-fetches
 *   while the component is mounted (FR-008).
 * - Sorting state is internal; defaults to sorting `editedSeconds` desc which —
 *   thanks to a custom sortingFn — pushes the "Sem atribuição" bucket to the
 *   end of each level (FR-006).
 */
export function useChaptersTable({
  chapters,
  grouping,
  pricePerHourCents,
}: UseChaptersTableArgs): UseChaptersTableReturn {
  const [sorting, setSorting] = useState<SortingState>([{ id: "editedSeconds", desc: true }]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const groupingArray = useMemo<GroupingState>(() => [...grouping], [grouping]);

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

    const countByStatusAggregation = (
      _columnId: string,
      leafRows: ReadonlyArray<Row<ChapterRowEntity>>,
    ) => {
      const leafChapters = leafRows.map((leaf) => leaf.original);
      return countByStatus(leafChapters);
    };

    return [
      {
        id: "number",
        accessorKey: "number",
        header: "Nº",
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
      {
        id: "statusBreakdown",
        accessorFn: (row) => row.status,
        header: "Status breakdown",
        enableGrouping: false,
        enableSorting: false,
        // biome-ignore lint/suspicious/noExplicitAny: TanStack v8 typing
        aggregationFn: countByStatusAggregation as any,
      },
    ];
  }, [pricePerHourCents]);

  const table = useReactTable({
    data: chapters as ChapterRowEntity[],
    columns,
    state: {
      grouping: groupingArray,
      expanded,
      sorting,
    },
    onGroupingChange: () => {
      // Controlled via URL upstream — no-op here. Grouping is set externally.
    },
    onExpandedChange: setExpanded,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableGrouping: true,
    autoResetExpanded: false,
  });

  return { table };
}

export { leafChaptersFromRow };
