import { DomainError } from "./domain-error";

export class ChapterNotFoundError extends DomainError {
  readonly code = "CHAPTER_NOT_FOUND";
  constructor(readonly id: string) {
    super("Chapter not found");
    this.name = "ChapterNotFoundError";
  }
}

export class ChapterTitleInvalidError extends DomainError {
  readonly code = "CHAPTER_TITLE_INVALID";
  constructor(readonly reason: "empty" | "too_long" | "has_newline") {
    super("Chapter title invalid");
    this.name = "ChapterTitleInvalidError";
  }
}

export class ChapterPositionTargetInvalidError extends DomainError {
  readonly code = "CHAPTER_POSITION_TARGET_INVALID";
  constructor(readonly chapterId: string | null) {
    super("Chapter position target invalid");
    this.name = "ChapterPositionTargetInvalidError";
  }
}

export class ChaptersOrderMismatchError extends DomainError {
  readonly code = "CHAPTERS_ORDER_MISMATCH";
  constructor(readonly bookId: string) {
    super("Chapters order mismatch");
    this.name = "ChaptersOrderMismatchError";
  }
}

export class ChapterPaidLockedError extends DomainError {
  readonly code = "CHAPTER_PAID_LOCKED";
  constructor(readonly id: string) {
    super("Chapter locked by paid status");
    this.name = "ChapterPaidLockedError";
  }
}

export class ChapterInvalidTransitionError extends DomainError {
  readonly code = "CHAPTER_INVALID_TRANSITION";
  constructor(
    readonly from: string,
    readonly to: string,
  ) {
    super("Chapter invalid transition");
    this.name = "ChapterInvalidTransitionError";
  }
}

export class ChapterNarratorRequiredError extends DomainError {
  readonly code = "CHAPTER_NARRATOR_REQUIRED";
  constructor() {
    super("Chapter narrator required");
    this.name = "ChapterNarratorRequiredError";
  }
}

export class ChapterEditorOrSecondsRequiredError extends DomainError {
  readonly code = "CHAPTER_EDITOR_OR_SECONDS_REQUIRED";
  constructor() {
    super("Chapter editor or seconds required");
    this.name = "ChapterEditorOrSecondsRequiredError";
  }
}

export class ChapterReversionConfirmationRequiredError extends DomainError {
  readonly code = "CHAPTER_REVERSION_CONFIRMATION_REQUIRED";
  constructor() {
    super("Chapter reversion confirmation required");
    this.name = "ChapterReversionConfirmationRequiredError";
  }
}

export class ChaptersNotInBookError extends DomainError {
  readonly code = "CHAPTERS_NOT_IN_BOOK";
  constructor(
    readonly bookId: string,
    readonly chapterIds: ReadonlyArray<string>,
  ) {
    super("Chapters not in book");
    this.name = "ChaptersNotInBookError";
  }
}

export class ChapterTitleAlreadyInUseError extends DomainError {
  readonly code = "CHAPTER_TITLE_ALREADY_IN_USE";
  constructor(
    readonly bookId: string,
    readonly title: string,
  ) {
    super("Chapter title already in use in this book");
    this.name = "ChapterTitleAlreadyInUseError";
  }
}
