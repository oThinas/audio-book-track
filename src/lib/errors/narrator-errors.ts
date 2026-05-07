import { DomainError } from "./domain-error";
import type { BlockingBookSummary } from "./studio-errors";

export class NarratorNameAlreadyInUseError extends DomainError {
  readonly code = "NAME_ALREADY_IN_USE";
  constructor(readonly narratorName: string) {
    super("Narrator name already in use");
    this.name = "NarratorNameAlreadyInUseError";
  }
}

export class NarratorNotFoundError extends DomainError {
  readonly code = "NARRATOR_NOT_FOUND";
  constructor(readonly id: string) {
    super("Narrator not found");
    this.name = "NarratorNotFoundError";
  }
}

export class NarratorReferenceInvalidError extends DomainError {
  readonly code = "NARRATOR_REFERENCE_INVALID";
  constructor(readonly narratorId: string) {
    super("Narrator reference invalid");
    this.name = "NarratorReferenceInvalidError";
  }
}

export class NarratorLinkedToActiveChaptersError extends DomainError {
  readonly code = "NARRATOR_LINKED_TO_ACTIVE_CHAPTERS";
  constructor(
    readonly id: string,
    readonly books: ReadonlyArray<BlockingBookSummary>,
  ) {
    super("Narrator linked to active chapters");
    this.name = "NarratorLinkedToActiveChaptersError";
  }
  getDetails() {
    return { books: this.books };
  }
}
