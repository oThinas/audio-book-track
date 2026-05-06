import type { BlockingBookSummary } from "@/lib/errors/studio-errors";

export class EditorNameAlreadyInUseError extends Error {
  constructor(name: string) {
    super(`Name already registered: ${name}`);
    this.name = "EditorNameAlreadyInUseError";
  }
}

export class EditorEmailAlreadyInUseError extends Error {
  constructor(email: string) {
    super(`Email already registered: ${email}`);
    this.name = "EditorEmailAlreadyInUseError";
  }
}

export class EditorNotFoundError extends Error {
  constructor(id: string) {
    super(`Editor not found: ${id}`);
    this.name = "EditorNotFoundError";
  }
}

export class EditorLinkedToActiveChaptersError extends Error {
  constructor(
    id: string,
    readonly books: ReadonlyArray<BlockingBookSummary>,
  ) {
    super(
      `Editor ${id} is linked to chapters in ${books.length} active book(s) — soft-delete blocked.`,
    );
    this.name = "EditorLinkedToActiveChaptersError";
  }
}
