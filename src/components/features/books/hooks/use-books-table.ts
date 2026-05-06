"use client";

import {
  type ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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

  const handleRowClick = useMemo(() => (id: string) => router.push(`/books/${id}`), [router]);

  function handleRowKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>, id: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      router.push(`/books/${id}`);
    }
  }

  return { table, handleRowClick, handleRowKeyDown };
}
