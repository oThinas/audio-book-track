import { describe, expect, it } from "vitest";

import { errorCodes } from "@/lib/api/error-codes";
import {
  BookCannotReduceChaptersError,
  BookChaptersVersionConflictError,
  BookInlineStudioInvalidError,
  BookNotFoundError,
  BookPaidPriceLockedError,
  BookPaidStudioLockedError,
  BookTitleAlreadyInUseError,
} from "@/lib/errors/book-errors";
import {
  ChapterEditorOrSecondsRequiredError,
  ChapterInvalidTransitionError,
  ChapterNarratorRequiredError,
  ChapterNotFoundError,
  ChapterPaidLockedError,
  ChapterPositionTargetInvalidError,
  ChapterReversionConfirmationRequiredError,
  ChaptersNotInBookError,
  ChaptersOrderMismatchError,
  ChapterTitleInvalidError,
} from "@/lib/errors/chapter-errors";
import { DomainError } from "@/lib/errors/domain-error";
import {
  EditorEmailAlreadyInUseError,
  EditorLinkedToActiveChaptersError,
  EditorNameAlreadyInUseError,
  EditorNotFoundError,
  EditorReferenceInvalidError,
} from "@/lib/errors/editor-errors";
import {
  NarratorLinkedToActiveChaptersError,
  NarratorNameAlreadyInUseError,
  NarratorNotFoundError,
  NarratorReferenceInvalidError,
} from "@/lib/errors/narrator-errors";
import {
  StudioHasActiveBooksError,
  StudioNameAlreadyInUseError,
  StudioNotFoundError,
  StudioReferenceInvalidError,
} from "@/lib/errors/studio-errors";

describe("domain Error classes — static messages (FR-018)", () => {
  it("Error.message is the same regardless of constructor arguments", () => {
    const a = new BookNotFoundError("11111111-1111-4111-8111-111111111111");
    const b = new BookNotFoundError("22222222-2222-4222-8222-222222222222");
    expect(a.message).toBe(b.message);
    expect(a.message).not.toContain("11111111");
    expect(a.message).not.toContain("22222222");
  });

  it("messages do not contain dynamic tokens (UUID, ${, etc.)", () => {
    const samples: Array<Error> = [
      new BookNotFoundError("11111111-1111-4111-8111-111111111111"),
      new BookTitleAlreadyInUseError("Algum Título", "11111111-1111-4111-8111-111111111111"),
      new BookInlineStudioInvalidError("11111111-1111-4111-8111-111111111111"),
      new BookPaidPriceLockedError("11111111-1111-4111-8111-111111111111"),
      new BookPaidStudioLockedError("11111111-1111-4111-8111-111111111111"),
      new BookCannotReduceChaptersError(10, 3),
      new ChapterNotFoundError("11111111-1111-4111-8111-111111111111"),
      new ChapterTitleInvalidError("empty"),
      new ChapterPositionTargetInvalidError("11111111-1111-4111-8111-111111111111"),
      new ChaptersOrderMismatchError("11111111-1111-4111-8111-111111111111"),
      new BookChaptersVersionConflictError("11111111-1111-4111-8111-111111111111", 1, 2),
      new ChapterPaidLockedError("11111111-1111-4111-8111-111111111111"),
      new ChapterInvalidTransitionError("pending", "paid"),
      new ChapterNarratorRequiredError(),
      new ChapterEditorOrSecondsRequiredError(),
      new ChapterReversionConfirmationRequiredError(),
      new ChaptersNotInBookError("11111111-1111-4111-8111-111111111111", [
        "22222222-2222-4222-8222-222222222222",
      ]),
      new StudioNotFoundError("11111111-1111-4111-8111-111111111111"),
      new StudioNameAlreadyInUseError("Estúdio Alpha"),
      new StudioReferenceInvalidError("11111111-1111-4111-8111-111111111111"),
      new StudioHasActiveBooksError("11111111-1111-4111-8111-111111111111", [
        { id: "22222222-2222-4222-8222-222222222222", title: "Livro Bloqueante" },
      ]),
      new NarratorNotFoundError("11111111-1111-4111-8111-111111111111"),
      new NarratorReferenceInvalidError("11111111-1111-4111-8111-111111111111"),
      new NarratorNameAlreadyInUseError("Pedro Narrador"),
      new NarratorLinkedToActiveChaptersError("11111111-1111-4111-8111-111111111111", [
        { id: "22222222-2222-4222-8222-222222222222", title: "Livro" },
      ]),
      new EditorNotFoundError("11111111-1111-4111-8111-111111111111"),
      new EditorReferenceInvalidError("11111111-1111-4111-8111-111111111111"),
      new EditorNameAlreadyInUseError("Editor Beta"),
      new EditorEmailAlreadyInUseError("alguem@example.com"),
      new EditorLinkedToActiveChaptersError("11111111-1111-4111-8111-111111111111", [
        { id: "22222222-2222-4222-8222-222222222222", title: "Livro" },
      ]),
    ];

    const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    for (const e of samples) {
      expect(e.message, `${e.name} message should not contain UUIDs`).not.toMatch(UUID_REGEX);
      expect(
        e.message,
        `${e.name} message should not contain template-literal markers`,
      ).not.toMatch(/\$\{/);
      expect(e.message.length, `${e.name} message should not be empty`).toBeGreaterThan(0);
    }
  });

  it("dynamic data is exposed as readonly public properties", () => {
    const bookNotFound = new BookNotFoundError("11111111-1111-4111-8111-111111111111");
    expect(bookNotFound.id).toBe("11111111-1111-4111-8111-111111111111");

    const titleInUse = new BookTitleAlreadyInUseError("Algum Título", "studio-id");
    expect(titleInUse.title).toBe("Algum Título");
    expect(titleInUse.studioId).toBe("studio-id");

    const cannotReduce = new BookCannotReduceChaptersError(10, 3);
    expect(cannotReduce.currentTotal).toBe(10);
    expect(cannotReduce.requested).toBe(3);

    const studioBlocked = new StudioHasActiveBooksError("studio-id", [
      { id: "book-id", title: "Livro X" },
    ]);
    expect(studioBlocked.id).toBe("studio-id");
    expect(studioBlocked.books[0].title).toBe("Livro X");

    const studioRefInvalid = new StudioReferenceInvalidError("studio-id");
    expect(studioRefInvalid.studioId).toBe("studio-id");
  });

  it("name property matches the class name", () => {
    expect(new BookNotFoundError("x").name).toBe("BookNotFoundError");
    expect(new StudioReferenceInvalidError("x").name).toBe("StudioReferenceInvalidError");
    expect(new ChapterPaidLockedError("x").name).toBe("ChapterPaidLockedError");
  });
});

describe("DomainError contract", () => {
  const samples: Array<DomainError> = [
    new BookNotFoundError("id"),
    new BookTitleAlreadyInUseError("Título", "studio-id"),
    new BookInlineStudioInvalidError("studio-id"),
    new BookPaidPriceLockedError("book-id"),
    new BookPaidStudioLockedError("book-id"),
    new BookCannotReduceChaptersError(10, 3),
    new ChapterNotFoundError("id"),
    new ChapterTitleInvalidError("too_long"),
    new ChapterPositionTargetInvalidError(null),
    new ChaptersOrderMismatchError("book-id"),
    new BookChaptersVersionConflictError("book-id", 0, 1),
    new ChapterPaidLockedError("id"),
    new ChapterInvalidTransitionError("pending", "paid"),
    new ChapterNarratorRequiredError(),
    new ChapterEditorOrSecondsRequiredError(),
    new ChapterReversionConfirmationRequiredError(),
    new ChaptersNotInBookError("book-id", ["chapter-id"]),
    new StudioNotFoundError("id"),
    new StudioNameAlreadyInUseError("Estúdio"),
    new StudioReferenceInvalidError("studio-id"),
    new StudioHasActiveBooksError("studio-id", [{ id: "book-id", title: "Livro" }]),
    new NarratorNotFoundError("id"),
    new NarratorReferenceInvalidError("narrator-id"),
    new NarratorNameAlreadyInUseError("Pedro"),
    new NarratorLinkedToActiveChaptersError("id", [{ id: "book-id", title: "Livro" }]),
    new EditorNotFoundError("id"),
    new EditorReferenceInvalidError("editor-id"),
    new EditorNameAlreadyInUseError("Editor"),
    new EditorEmailAlreadyInUseError("alguem@example.com"),
    new EditorLinkedToActiveChaptersError("id", [{ id: "book-id", title: "Livro" }]),
  ];

  it("every sampled domain error is an instance of DomainError", () => {
    for (const error of samples) {
      expect(error, `${error.name} must extend DomainError`).toBeInstanceOf(DomainError);
    }
  });

  it("every domain error declares a code present in the catalog", () => {
    for (const error of samples) {
      expect(
        Object.hasOwn(errorCodes, error.code),
        `${error.name} declares code "${error.code}" which is not in errorCodes`,
      ).toBe(true);
    }
  });

  it("getDetails() exposes structured data for the three blocking-list errors", () => {
    const studio = new StudioHasActiveBooksError("studio-id", [{ id: "book-id", title: "Livro" }]);
    expect(studio.getDetails?.()).toEqual({ books: [{ id: "book-id", title: "Livro" }] });

    const narrator = new NarratorLinkedToActiveChaptersError("id", [
      { id: "book-id", title: "Livro" },
    ]);
    expect(narrator.getDetails?.()).toEqual({ books: [{ id: "book-id", title: "Livro" }] });

    const editor = new EditorLinkedToActiveChaptersError("id", [{ id: "book-id", title: "Livro" }]);
    expect(editor.getDetails?.()).toEqual({ books: [{ id: "book-id", title: "Livro" }] });
  });

  it("getDetails() is undefined on errors without structured data", () => {
    const e = new BookNotFoundError("id");
    expect(e.getDetails).toBeUndefined();
  });
});
