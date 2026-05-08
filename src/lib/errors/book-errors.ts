import { DomainError } from "./domain-error";

export class BookNotFoundError extends DomainError {
  readonly code = "BOOK_NOT_FOUND";
  constructor(readonly id: string) {
    super("Book not found");
    this.name = "BookNotFoundError";
  }
}

export class BookTitleAlreadyInUseError extends DomainError {
  readonly code = "TITLE_ALREADY_IN_USE";
  constructor(
    readonly title: string,
    readonly studioId: string,
  ) {
    super("Book title already in use");
    this.name = "BookTitleAlreadyInUseError";
  }
}

export class BookInlineStudioInvalidError extends DomainError {
  readonly code = "INLINE_STUDIO_INVALID";
  constructor(readonly studioId: string) {
    super("Inline studio invalid");
    this.name = "BookInlineStudioInvalidError";
  }
}

export class BookPaidPriceLockedError extends DomainError {
  readonly code = "BOOK_PAID_PRICE_LOCKED";
  constructor(readonly bookId: string) {
    super("Book price locked by paid chapter");
    this.name = "BookPaidPriceLockedError";
  }
}

export class BookPaidStudioLockedError extends DomainError {
  readonly code = "BOOK_PAID_STUDIO_LOCKED";
  constructor(readonly bookId: string) {
    super("Book studio locked by paid chapter");
    this.name = "BookPaidStudioLockedError";
  }
}

export class BookCannotReduceChaptersError extends DomainError {
  readonly code = "BOOK_CANNOT_REDUCE_CHAPTERS";
  constructor(
    readonly currentTotal: number,
    readonly requested: number,
  ) {
    super("Cannot reduce chapters below current total");
    this.name = "BookCannotReduceChaptersError";
  }
}
