export interface BlockingBookSummary {
  readonly id: string;
  readonly title: string;
}

export class StudioNameAlreadyInUseError extends Error {
  constructor(name: string) {
    super(`Name already registered: ${name}`);
    this.name = "StudioNameAlreadyInUseError";
  }
}

export class StudioNotFoundError extends Error {
  constructor(id: string) {
    super(`Studio not found: ${id}`);
    this.name = "StudioNotFoundError";
  }
}

export class StudioHasActiveBooksError extends Error {
  constructor(
    id: string,
    readonly books: ReadonlyArray<BlockingBookSummary>,
  ) {
    super(`Studio ${id} has ${books.length} book(s) with active chapters — soft-delete blocked.`);
    this.name = "StudioHasActiveBooksError";
  }
}
