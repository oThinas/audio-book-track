import { DomainError } from "./domain-error";

export interface BlockingBookSummary {
  readonly id: string;
  readonly title: string;
}

export class StudioNameAlreadyInUseError extends DomainError {
  readonly code = "NAME_ALREADY_IN_USE";
  constructor(readonly studioName: string) {
    super("Studio name already in use");
    this.name = "StudioNameAlreadyInUseError";
  }
}

export class StudioNotFoundError extends DomainError {
  readonly code = "STUDIO_NOT_FOUND";
  constructor(readonly id: string) {
    super("Studio not found");
    this.name = "StudioNotFoundError";
  }
}

export class StudioReferenceInvalidError extends DomainError {
  readonly code = "STUDIO_REFERENCE_INVALID";
  constructor(readonly studioId: string) {
    super("Studio reference invalid");
    this.name = "StudioReferenceInvalidError";
  }
}

export class StudioHasActiveBooksError extends DomainError {
  readonly code = "STUDIO_HAS_ACTIVE_BOOKS";
  constructor(
    readonly id: string,
    readonly books: ReadonlyArray<BlockingBookSummary>,
  ) {
    super("Studio has active books");
    this.name = "StudioHasActiveBooksError";
  }
  getDetails() {
    return { books: this.books };
  }
}
