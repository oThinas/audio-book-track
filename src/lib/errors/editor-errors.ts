import { DomainError } from "./domain-error";
import type { BlockingBookSummary } from "./studio-errors";

export class EditorNameAlreadyInUseError extends DomainError {
  readonly code = "NAME_ALREADY_IN_USE";
  constructor(readonly editorName: string) {
    super("Editor name already in use");
    this.name = "EditorNameAlreadyInUseError";
  }
}

export class EditorEmailAlreadyInUseError extends DomainError {
  readonly code = "EMAIL_ALREADY_IN_USE";
  constructor(readonly email: string) {
    super("Editor email already in use");
    this.name = "EditorEmailAlreadyInUseError";
  }
}

export class EditorNotFoundError extends DomainError {
  readonly code = "EDITOR_NOT_FOUND";
  constructor(readonly id: string) {
    super("Editor not found");
    this.name = "EditorNotFoundError";
  }
}

export class EditorLinkedToActiveChaptersError extends DomainError {
  readonly code = "EDITOR_LINKED_TO_ACTIVE_CHAPTERS";
  constructor(
    readonly id: string,
    readonly books: ReadonlyArray<BlockingBookSummary>,
  ) {
    super("Editor linked to active chapters");
    this.name = "EditorLinkedToActiveChaptersError";
  }
  getDetails() {
    return { books: this.books };
  }
}
