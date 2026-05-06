export class BookNotFoundError extends Error {
  constructor(id: string) {
    super(`Book not found: ${id}`);
    this.name = "BookNotFoundError";
  }
}

export class BookTitleAlreadyInUseError extends Error {
  constructor(title: string, studioId: string) {
    super(`Title already registered in studio ${studioId}: ${title}`);
    this.name = "BookTitleAlreadyInUseError";
  }
}

export class BookStudioNotFoundError extends Error {
  constructor(studioId: string) {
    super(`Studio not found or archived: ${studioId}`);
    this.name = "BookStudioNotFoundError";
  }
}

export class BookInlineStudioInvalidError extends Error {
  constructor(studioId: string) {
    super(`Invalid inline studio: ${studioId}`);
    this.name = "BookInlineStudioInvalidError";
  }
}

export class BookPaidPriceLockedError extends Error {
  constructor(bookId: string) {
    super(`Book ${bookId} has a paid chapter — price/hour cannot be changed.`);
    this.name = "BookPaidPriceLockedError";
  }
}

export class BookPaidStudioLockedError extends Error {
  constructor(bookId: string) {
    super(`Book ${bookId} has a paid chapter — studio cannot be changed.`);
    this.name = "BookPaidStudioLockedError";
  }
}

export class BookCannotReduceChaptersError extends Error {
  constructor(currentTotal: number, requested: number) {
    super(`Cannot reduce chapters: current total ${currentTotal}, requested ${requested}.`);
    this.name = "BookCannotReduceChaptersError";
  }
}
