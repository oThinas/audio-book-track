"use client";

import { Plus, Search } from "lucide-react";

import { PageDescription, PageHeader, PageTitle } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Studio } from "@/lib/domain/studio";

import { BookCreateDialog } from "./book-create-dialog";
import { type BookSummaryRow, BooksTable } from "./books-table";
import { useBooksList } from "./hooks/use-books-list";

interface BooksClientProps {
  readonly initialBooks: readonly BookSummaryRow[];
  readonly studios: readonly Studio[];
}

export function BooksClient({ initialBooks, studios }: BooksClientProps) {
  const {
    filteredBooks,
    search,
    setSearch,
    isCreateDialogOpen,
    openCreateDialog,
    setCreateDialogOpen,
    handleCreated,
  } = useBooksList(initialBooks);

  return (
    <div className="flex flex-col">
      <PageHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <PageTitle>Livros</PageTitle>
          <PageDescription>Acompanhe capítulos, ganhos e status por livro.</PageDescription>
        </div>
        <Button
          type="button"
          aria-label="Novo livro"
          aria-expanded={isCreateDialogOpen}
          className="p-5"
          onClick={openCreateDialog}
          data-testid="books-new-button"
        >
          <Plus aria-hidden="true" />
          Novo Livro
        </Button>
      </PageHeader>

      <div className="relative mb-3 max-w-sm">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por título ou estúdio"
          aria-label="Buscar livros"
          className="pl-9"
          data-testid="books-search-input"
        />
      </div>

      <BooksTable books={filteredBooks} />

      <BookCreateDialog
        open={isCreateDialogOpen}
        onOpenChange={setCreateDialogOpen}
        studios={studios}
        onCreated={handleCreated}
      />
    </div>
  );
}
