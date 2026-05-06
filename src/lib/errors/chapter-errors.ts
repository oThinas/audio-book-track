export class ChapterNotFoundError extends Error {
  constructor(id: string) {
    super(`Chapter not found: ${id}`);
    this.name = "ChapterNotFoundError";
  }
}

export class ChapterNumberAlreadyInUseError extends Error {
  constructor(bookId: string, number: number) {
    super(`Number ${number} already exists in book ${bookId}`);
    this.name = "ChapterNumberAlreadyInUseError";
  }
}

export class ChapterPaidLockedError extends Error {
  constructor(id: string) {
    super(
      `Chapter ${id} is in 'paid' status — narrator, editor and edited seconds cannot be changed.`,
    );
    this.name = "ChapterPaidLockedError";
  }
}

export class ChapterInvalidTransitionError extends Error {
  constructor(
    readonly from: string,
    readonly to: string,
  ) {
    super(`Invalid transition from '${from}' to '${to}'.`);
    this.name = "ChapterInvalidTransitionError";
  }
}

export class ChapterNarratorRequiredError extends Error {
  constructor() {
    super("Narrator is required to start editing.");
    this.name = "ChapterNarratorRequiredError";
  }
}

export class ChapterEditorOrSecondsRequiredError extends Error {
  constructor() {
    super("Editor and edited seconds (> 0) are required to send to review.");
    this.name = "ChapterEditorOrSecondsRequiredError";
  }
}

export class ChapterReversionConfirmationRequiredError extends Error {
  constructor() {
    super("Reverting from 'paid' to 'completed' requires explicit confirmation.");
    this.name = "ChapterReversionConfirmationRequiredError";
  }
}

export class ChaptersNotInBookError extends Error {
  constructor(bookId: string, chapterIds: ReadonlyArray<string>) {
    super(`Chapters do not belong to book ${bookId}: ${chapterIds.join(", ")}`);
    this.name = "ChaptersNotInBookError";
  }
}
