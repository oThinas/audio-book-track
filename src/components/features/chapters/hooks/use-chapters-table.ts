"use client";

import {
  type ColumnDef,
  getCoreRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";

import type { ChapterRowEntity } from "../chapter-row";

export interface UseChaptersTableArgs {
  readonly chapters: ReadonlyArray<ChapterRowEntity>;
  readonly columns: ColumnDef<ChapterRowEntity>[];
}

export interface UseChaptersTableReturn {
  readonly table: ReturnType<typeof useReactTable<ChapterRowEntity>>;
}

/**
 * Wraps `useReactTable` for the chapters table.
 *
 * M0: scope mínimo — core row model + sorting state (interno, sem header
 * controlado por click ainda). Tasks futuras (T018) adicionam grouping,
 * expansion e custom sorting.
 */
export function useChaptersTable({
  chapters,
  columns,
}: UseChaptersTableArgs): UseChaptersTableReturn {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: chapters as ChapterRowEntity[],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
  });

  return { table };
}
