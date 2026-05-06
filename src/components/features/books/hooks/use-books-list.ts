"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CreatedBook } from "../book-create-dialog";
import type { BookSummaryRow } from "../books-table";

export interface UseBooksListReturn {
  readonly books: readonly BookSummaryRow[];
  readonly filteredBooks: readonly BookSummaryRow[];
  readonly search: string;
  readonly setSearch: (next: string) => void;
  readonly isCreateDialogOpen: boolean;
  readonly openCreateDialog: () => void;
  readonly setCreateDialogOpen: (open: boolean) => void;
  readonly handleCreated: (created: CreatedBook) => void;
}

export function useBooksList(initial: readonly BookSummaryRow[]): UseBooksListReturn {
  const router = useRouter();
  const [books, setBooks] = useState<readonly BookSummaryRow[]>(initial);
  const [search, setSearch] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const filteredBooks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length === 0) return books;
    return books.filter(
      (b) => b.title.toLowerCase().includes(query) || b.studio.name.toLowerCase().includes(query),
    );
  }, [books, search]);

  function handleCreated(created: CreatedBook) {
    const optimistic: BookSummaryRow = {
      id: created.id,
      title: created.title,
      studio: created.studio,
      pricePerHourCents: created.pricePerHourCents,
      status: "pending",
      totalChapters: created.chapters.length,
      completedChapters: 0,
      totalEarningsCents: 0,
    };
    setBooks((current) => [optimistic, ...current]);
    setIsCreateDialogOpen(false);
    router.refresh();
  }

  return {
    books,
    filteredBooks,
    search,
    setSearch,
    isCreateDialogOpen,
    openCreateDialog: () => setIsCreateDialogOpen(true),
    setCreateDialogOpen: setIsCreateDialogOpen,
    handleCreated,
  };
}
