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
import type { ReactNode } from "react";
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
import type { Studio } from "@/lib/domain/studio";
import type { StudioListItem } from "@/lib/repositories/studio-repository";

import { StudioRow } from "./studio-row";

interface StudiosTableProps {
  readonly studios: readonly StudioListItem[];
  readonly topRow?: ReactNode;
  readonly onStudioUpdated?: (studio: Studio) => void;
  readonly onRequestDelete?: (studio: Studio) => void;
}

function SortIcon({ direction }: { direction: false | "asc" | "desc" }) {
  if (direction === "asc") return <ArrowUp aria-hidden="true" className="size-3.5" />;
  if (direction === "desc") return <ArrowDown aria-hidden="true" className="size-3.5" />;
  return <ArrowUpDown aria-hidden="true" className="size-3.5 opacity-50" />;
}

export function StudiosTable({
  studios,
  topRow,
  onStudioUpdated,
  onRequestDelete,
}: StudiosTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<StudioListItem>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: "Nome",
        enableSorting: true,
      },
      {
        id: "defaultHourlyRateCents",
        accessorKey: "defaultHourlyRateCents",
        header: "Valor/hora",
        enableSorting: true,
        sortingFn: "basic",
        // Numeric columns default to sortDescFirst=true in TanStack Table.
        // Match the ascending-first behaviour of the Nome column so a single
        // click sorts low→high, which is the intuitive "sort by price" default.
        sortDescFirst: false,
      },
      {
        id: "booksCount",
        accessorKey: "booksCount",
        header: "Livros",
        enableSorting: true,
        sortingFn: "basic",
        sortDescFirst: false,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Ações</span>,
        enableSorting: false,
      },
    ],
    [],
  );

  const table = useReactTable({
    columns,
    data: studios as StudioListItem[],
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const sortedRows = table.getRowModel().rows;

  return (
    <ScrollArea data-testid="studios-scroll-area" className="max-h-[70vh] w-full rounded-lg border">
      <Table className="table-fixed">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sortDirection = header.column.getIsSorted();
                const label = flexRender(header.column.columnDef.header, header.getContext());
                const columnId = header.column.id;
                const widthClass =
                  columnId === "actions"
                    ? "w-24 text-right"
                    : columnId === "booksCount"
                      ? "w-24"
                      : columnId === "name"
                        ? "w-1/3"
                        : "w-auto";
                const ariaSort = canSort
                  ? sortDirection === "asc"
                    ? "ascending"
                    : sortDirection === "desc"
                      ? "descending"
                      : "none"
                  : undefined;
                return (
                  <TableHead key={header.id} className={widthClass} aria-sort={ariaSort}>
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
          {topRow}
          {sortedRows.map((row) => (
            <StudioRow
              key={row.original.id}
              studio={row.original}
              onUpdated={onStudioUpdated}
              onRequestDelete={onRequestDelete}
            />
          ))}
          {sortedRows.length === 0 && !topRow && (
            <TableRow>
              <TableCell colSpan={columns.length} className="p-0">
                <div
                  data-testid="studios-empty-state"
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <p className="text-sm font-medium text-foreground">Nenhum estúdio cadastrado</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Clique em &quot;+ Novo Estúdio&quot; para adicionar o primeiro.
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
