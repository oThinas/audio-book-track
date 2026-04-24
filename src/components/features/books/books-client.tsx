"use client";

import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { PageDescription, PageHeader, PageTitle } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { type BookSummaryRow, BooksTable } from "./books-table";

interface BooksClientProps {
  readonly initialBooks: readonly BookSummaryRow[];
}

export function BooksClient({ initialBooks }: BooksClientProps) {
  const [books] = useState<readonly BookSummaryRow[]>(initialBooks);
  const [search, setSearch] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const filteredBooks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length === 0) return books;
    return books.filter(
      (b) => b.title.toLowerCase().includes(query) || b.studio.name.toLowerCase().includes(query),
    );
  }, [books, search]);

  function handleNewClick() {
    // Placeholder until US2 wires the create dialog (T057).
    setIsCreateDialogOpen((open) => !open);
  }

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
          onClick={handleNewClick}
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
    </div>
  );
}
