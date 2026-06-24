"use client";

import {
  type ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { addTransitionType, startTransition, useCallback, useState } from "react";
import type { BookSummaryRow } from "../books-table";

export interface UseBooksTableArgs {
  readonly books: readonly BookSummaryRow[];
  readonly columns: ColumnDef<BookSummaryRow>[];
}

export interface UseBooksTableReturn {
  readonly table: ReturnType<typeof useReactTable<BookSummaryRow>>;
  readonly handleRowClick: (id: string) => void;
  readonly handleRowKeyDown: (event: React.KeyboardEvent<HTMLTableRowElement>, id: string) => void;
}

export function useBooksTable({ books, columns }: UseBooksTableArgs): UseBooksTableReturn {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: books as BookSummaryRow[],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // List -> detail is always a depth-forward view transition. router.push is
  // programmatic, so the type is registered via addTransitionType inside the
  // navigation transition (the Link `transitionTypes` equivalent).
  const navigateToDetail = useCallback(
    (id: string) => {
      startTransition(() => {
        addTransitionType("depth-forward");
        router.push(`/books/${id}`);
      });
    },
    [router],
  );

  function handleRowKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>, id: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigateToDetail(id);
    }
  }

  return { table, handleRowClick: navigateToDetail, handleRowKeyDown };
}
