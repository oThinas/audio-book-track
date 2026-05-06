import type { BlockingBookSummary } from "@/lib/errors/studio-errors";

export class NarratorNameAlreadyInUseError extends Error {
  constructor(name: string) {
    super(`Name already registered: ${name}`);
    this.name = "NarratorNameAlreadyInUseError";
  }
}

export class NarratorNotFoundError extends Error {
  constructor(id: string) {
    super(`Narrator not found: ${id}`);
    this.name = "NarratorNotFoundError";
  }
}

export class NarratorLinkedToActiveChaptersError extends Error {
  constructor(
    id: string,
    readonly books: ReadonlyArray<BlockingBookSummary>,
  ) {
    super(
      `Narrator ${id} is linked to chapters in ${books.length} active book(s) — soft-delete blocked.`,
    );
    this.name = "NarratorLinkedToActiveChaptersError";
  }
}
