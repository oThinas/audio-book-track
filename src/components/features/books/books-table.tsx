"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BookStatus } from "@/lib/domain/book";
import { formatCentsBRL } from "@/lib/utils";

export interface BookSummaryRow {
  readonly id: string;
  readonly title: string;
  readonly studio: { readonly id: string; readonly name: string };
  readonly pricePerHourCents: number;
  readonly status: BookStatus;
  readonly totalChapters: number;
  readonly completedChapters: number;
  readonly totalEarningsCents: number;
}

interface BooksTableProps {
  readonly books: readonly BookSummaryRow[];
}

const STATUS_LABELS: Record<BookStatus, string> = {
  pending: "Pendente",
  editing: "Em edição",
  reviewing: "Em revisão",
  retake: "Retake",
  completed: "Concluído",
  paid: "Pago",
};

const STATUS_CLASSES: Record<BookStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  editing: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  reviewing: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  retake: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  paid: "bg-primary/15 text-primary",
};

function StatusBadge({ status }: { status: BookStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function SortIcon({ direction }: { direction: false | "asc" | "desc" }) {
  if (direction === "asc") return <ArrowUp aria-hidden="true" className="size-3.5" />;
  if (direction === "desc") return <ArrowDown aria-hidden="true" className="size-3.5" />;
  return <ArrowUpDown aria-hidden="true" className="size-3.5 opacity-50" />;
}

export function BooksTable({ books }: BooksTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<BookSummaryRow>[]>(
    () => [
      {
        id: "title",
        accessorKey: "title",
        header: "Título",
        enableSorting: true,
      },
      {
        id: "studio",
        accessorFn: (row) => row.studio.name,
        header: "Estúdio",
        enableSorting: true,
      },
      {
        id: "chapters",
        accessorFn: (row) => row.totalChapters,
        header: "Capítulos",
        enableSorting: true,
        sortDescFirst: false,
        cell: ({ row }) => (
          <span>
            {row.original.completedChapters}/{row.original.totalChapters}
          </span>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        enableSorting: true,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "pricePerHourCents",
        accessorKey: "pricePerHourCents",
        header: "R$/hora",
        enableSorting: true,
        sortDescFirst: false,
        cell: ({ row }) => formatCentsBRL(row.original.pricePerHourCents),
      },
      {
        id: "totalEarningsCents",
        accessorKey: "totalEarningsCents",
        header: "Ganho total",
        enableSorting: true,
        sortDescFirst: false,
        cell: ({ row }) => formatCentsBRL(row.original.totalEarningsCents),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: books as BookSummaryRow[],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <ScrollArea data-testid="books-scroll-area" className="max-h-[70vh] w-full rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sortDirection = header.column.getIsSorted();
                const label = flexRender(header.column.columnDef.header, header.getContext());
                const ariaSort = canSort
                  ? sortDirection === "asc"
                    ? "ascending"
                    : sortDirection === "desc"
                      ? "descending"
                      : "none"
                  : undefined;
                return (
                  <TableHead key={header.id} aria-sort={ariaSort}>
                    {canSort ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={header.column.getToggleSortingHandler()}
                        className="-ml-2 gap-1.5"
                      >
                        {label}
                        <SortIcon direction={sortDirection} />
                      </Button>
                    ) : (
                      label
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.original.id}
              data-testid={`book-row-${row.original.id}`}
              className="cursor-pointer"
              onClick={() => router.push(`/books/${row.original.id}`)}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  router.push(`/books/${row.original.id}`);
                }
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {cell.column.columnDef.cell
                    ? flexRender(cell.column.columnDef.cell, cell.getContext())
                    : String(cell.getValue() ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="p-0">
                <div
                  data-testid="books-empty-state"
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <p className="text-sm font-medium text-foreground">Nenhum livro encontrado</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ajuste a busca ou clique em &quot;+ Novo Livro&quot; para adicionar.
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
