import type { Book, BookStatus } from "@/lib/domain/book";
import type { Chapter, ChapterStatus } from "@/lib/domain/chapter";
import { CHAPTER_TEMPLATES, type ChapterTemplateKey } from "@/lib/domain/chapter-templates";
import { findDuplicateChapterTitle } from "@/lib/domain/chapter-title";
import { computeEarningsCents } from "@/lib/domain/earnings";
import { nextChapterTitle } from "@/lib/domain/next-chapter-title";
import { densifyPositions } from "@/lib/domain/normalize-positions";
import { currentWeekRangeInAppTimezone, todayInAppTimezone } from "@/lib/domain/timezone";
import {
  BookInlineStudioInvalidError,
  BookNotFoundError,
  BookPaidPriceLockedError,
  BookPaidStudioLockedError,
} from "@/lib/errors/book-errors";
import { ChapterTitleAlreadyInUseError } from "@/lib/errors/chapter-errors";
import { StudioReferenceInvalidError } from "@/lib/errors/studio-errors";
import type { BookRepository, BookSummary } from "@/lib/repositories/book-repository";
import type { ChapterRepository } from "@/lib/repositories/chapter-repository";
import type { EditorRepository } from "@/lib/repositories/editor-repository";
import type { NarratorRepository } from "@/lib/repositories/narrator-repository";
import type { StudioRepository } from "@/lib/repositories/studio-repository";
import type { UnitOfWork } from "@/lib/repositories/unit-of-work";

import { recomputeBookStatusAndBumpVersion } from "./book-status-recompute";

export interface BookServiceDeps {
  readonly bookRepo: BookRepository;
  readonly chapterRepo: ChapterRepository;
  readonly studioRepo: StudioRepository;
  readonly narratorRepo: NarratorRepository;
  readonly editorRepo: EditorRepository;
  readonly uow: UnitOfWork;
}

export type CreateBookExtra =
  | {
      readonly kind: "template";
      readonly template: ChapterTemplateKey;
      readonly position: "start" | "end";
    }
  | { readonly kind: "custom"; readonly title: string; readonly position: "start" | "end" };

export interface CreateBookChaptersInput {
  readonly numbered: number;
  readonly extras: ReadonlyArray<CreateBookExtra>;
}

export interface CreateBookServiceInput {
  readonly title: string;
  readonly studioId: string;
  readonly pricePerHourCents: number;
  readonly chapters: CreateBookChaptersInput;
  readonly inlineStudioId?: string;
}

const INLINE_STUDIO_PLACEHOLDER_RATE_CENTS = 1;

export interface CreateBookResult {
  readonly book: Book;
  readonly chapters: readonly Chapter[];
}

export interface UpdateBookServiceInput {
  readonly title?: string;
  readonly studioId?: string;
  readonly pricePerHourCents?: number;
  readonly inlineStudioId?: string;
  // null → remove a URL persistida; undefined → preserva; string → atualiza.
  readonly pdfUrl?: string | null;
}

export interface UpdateBookResult {
  readonly book: Book;
}

export interface BookChapterDetail {
  readonly id: string;
  readonly title: string;
  readonly position: number;
  readonly status: ChapterStatus;
  readonly narrator: { readonly id: string; readonly name: string } | null;
  readonly editor: { readonly id: string; readonly name: string } | null;
  readonly editedSeconds: number;
  readonly deadline: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface BookDetail {
  readonly id: string;
  readonly title: string;
  readonly studio: { readonly id: string; readonly name: string };
  readonly pricePerHourCents: number;
  readonly chaptersVersion: number;
  readonly pdfUrl: string | null;
  readonly status: BookStatus;
  readonly totalChapters: number;
  readonly completedChapters: number;
  readonly totalEarningsCents: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly chapters: ReadonlyArray<BookChapterDetail>;
}

const COMPLETED_STATUSES: ReadonlyArray<ChapterStatus> = ["completed", "paid"];

export class BookService {
  constructor(protected readonly deps: BookServiceDeps) {}

  async list(): Promise<BookSummary[]> {
    const todayIso = todayInAppTimezone();
    const { mondayIso, sundayIso } = currentWeekRangeInAppTimezone();
    return this.deps.bookRepo.listSummaries({ todayIso, mondayIso, sundayIso });
  }

  async findById(bookId: string): Promise<BookDetail | null> {
    const book = await this.deps.bookRepo.findById(bookId);
    if (!book) {
      return null;
    }

    const [studio, chapters] = await Promise.all([
      this.deps.studioRepo.findByIdIncludingDeleted(book.studioId),
      this.deps.chapterRepo.listByBookId(book.id),
    ]);
    if (!studio) {
      throw new Error(`Book ${book.id} references missing studio ${book.studioId}`);
    }

    const narratorIds = Array.from(
      new Set(chapters.map((c) => c.narratorId).filter((id): id is string => id !== null)),
    );
    const editorIds = Array.from(
      new Set(chapters.map((c) => c.editorId).filter((id): id is string => id !== null)),
    );

    const [narrators, editors] = await Promise.all([
      Promise.all(narratorIds.map((id) => this.deps.narratorRepo.findById(id))),
      Promise.all(editorIds.map((id) => this.deps.editorRepo.findById(id))),
    ]);

    const narratorMap = new Map(
      narrators
        .filter((n): n is NonNullable<typeof n> => n !== null)
        .map((n) => [n.id, { id: n.id, name: n.name }]),
    );
    const editorMap = new Map(
      editors
        .filter((e): e is NonNullable<typeof e> => e !== null)
        .map((e) => [e.id, { id: e.id, name: e.name }]),
    );

    let totalEarningsCents = 0;
    let completedChapters = 0;
    const chapterDetails = chapters.map((chapter): BookChapterDetail => {
      totalEarningsCents += computeEarningsCents(chapter.editedSeconds, book.pricePerHourCents);
      if (COMPLETED_STATUSES.includes(chapter.status)) {
        completedChapters += 1;
      }
      return {
        id: chapter.id,
        title: chapter.title,
        position: chapter.position,
        status: chapter.status,
        narrator: chapter.narratorId ? (narratorMap.get(chapter.narratorId) ?? null) : null,
        editor: chapter.editorId ? (editorMap.get(chapter.editorId) ?? null) : null,
        editedSeconds: chapter.editedSeconds,
        deadline: chapter.deadline,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
      };
    });

    return {
      id: book.id,
      title: book.title,
      studio: { id: studio.id, name: studio.name },
      pricePerHourCents: book.pricePerHourCents,
      chaptersVersion: book.chaptersVersion,
      pdfUrl: book.pdfUrl,
      status: book.status,
      totalChapters: chapters.length,
      completedChapters,
      totalEarningsCents,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
      chapters: chapterDetails,
    };
  }

  async create(input: CreateBookServiceInput): Promise<CreateBookResult> {
    if (input.inlineStudioId !== undefined) {
      if (input.inlineStudioId !== input.studioId) {
        throw new BookInlineStudioInvalidError(input.inlineStudioId);
      }
      const inlineStudio = await this.deps.studioRepo.findById(input.inlineStudioId);
      if (!inlineStudio) {
        throw new BookInlineStudioInvalidError(input.inlineStudioId);
      }
      if (inlineStudio.defaultHourlyRateCents !== INLINE_STUDIO_PLACEHOLDER_RATE_CENTS) {
        throw new BookInlineStudioInvalidError(input.inlineStudioId);
      }
    } else {
      const studio = await this.deps.studioRepo.findById(input.studioId);
      if (!studio) {
        throw new StudioReferenceInvalidError(input.studioId);
      }
    }

    return this.deps.uow.transaction(async (tx) => {
      if (input.inlineStudioId !== undefined) {
        await this.deps.studioRepo.update(
          input.inlineStudioId,
          { defaultHourlyRateCents: input.pricePerHourCents },
          tx,
        );
      }

      const inserted = await this.deps.bookRepo.insert(
        {
          title: input.title,
          studioId: input.studioId,
          pricePerHourCents: input.pricePerHourCents,
        },
        tx,
      );

      const chaptersToInsert = buildChaptersForCreate(inserted.id, input.chapters);
      const duplicate = findDuplicateChapterTitle(chaptersToInsert.map((c) => c.title));
      if (duplicate !== null) {
        throw new ChapterTitleAlreadyInUseError(inserted.id, duplicate);
      }
      const chapters = await this.deps.chapterRepo.insertMany(chaptersToInsert, tx);

      const withStatus = await recomputeBookStatusAndBumpVersion(
        inserted.id,
        { bookRepo: this.deps.bookRepo, chapterRepo: this.deps.chapterRepo },
        tx,
      );

      return { book: withStatus, chapters };
    });
  }

  async update(bookId: string, input: UpdateBookServiceInput): Promise<UpdateBookResult> {
    const current = await this.deps.bookRepo.findById(bookId);
    if (!current) {
      throw new BookNotFoundError(bookId);
    }

    const chapters = await this.deps.chapterRepo.listByBookId(bookId);
    const hasPaidChapter = chapters.some((c) => c.status === "paid");

    if (input.pricePerHourCents !== undefined && hasPaidChapter) {
      throw new BookPaidPriceLockedError(bookId);
    }
    if (input.studioId !== undefined && input.studioId !== current.studioId && hasPaidChapter) {
      throw new BookPaidStudioLockedError(bookId);
    }

    if (input.inlineStudioId !== undefined) {
      if (input.inlineStudioId !== input.studioId) {
        throw new BookInlineStudioInvalidError(input.inlineStudioId);
      }
      const inlineStudio = await this.deps.studioRepo.findById(input.inlineStudioId);
      if (!inlineStudio) {
        throw new BookInlineStudioInvalidError(input.inlineStudioId);
      }
      if (inlineStudio.defaultHourlyRateCents !== INLINE_STUDIO_PLACEHOLDER_RATE_CENTS) {
        throw new BookInlineStudioInvalidError(input.inlineStudioId);
      }
    } else if (input.studioId !== undefined && input.studioId !== current.studioId) {
      const studio = await this.deps.studioRepo.findById(input.studioId);
      if (!studio) {
        throw new StudioReferenceInvalidError(input.studioId);
      }
    }

    // The repo accepts only persistent book fields. `inlineStudioId` is a
    // service-level concept handled separately.
    const { inlineStudioId: _ignoredInline, ...repoPatch } = input;
    const patchEntries = Object.entries(repoPatch).filter(([, value]) => value !== undefined);
    const propagatedRateCents = input.pricePerHourCents ?? current.pricePerHourCents;

    return this.deps.uow.transaction(async (tx) => {
      if (input.inlineStudioId !== undefined) {
        await this.deps.studioRepo.update(
          input.inlineStudioId,
          { defaultHourlyRateCents: propagatedRateCents },
          tx,
        );
      }

      let book = current;
      if (patchEntries.length > 0) {
        book = await this.deps.bookRepo.update(bookId, Object.fromEntries(patchEntries), tx);
      }

      return { book };
    });
  }
}

interface ChapterInsertPlan {
  readonly bookId: string;
  readonly title: string;
  readonly position: number;
  readonly status: "pending";
}

function buildChaptersForCreate(
  bookId: string,
  input: CreateBookChaptersInput,
): ChapterInsertPlan[] {
  const numberedTitles: string[] = [];
  for (let i = 0; i < input.numbered; i += 1) {
    numberedTitles.push(nextChapterTitle(numberedTitles));
  }
  const startExtras = input.extras.filter((e) => e.position === "start");
  const endExtras = input.extras.filter((e) => e.position === "end");

  function extraToTitle(extra: CreateBookExtra): string {
    return extra.kind === "template"
      ? CHAPTER_TEMPLATES[extra.template as ChapterTemplateKey].defaultTitle
      : extra.title;
  }

  // Cada extra "start" empilha no início; o último declarado fica em position 0.
  const orderedTitles: string[] = [];
  for (const e of startExtras) {
    orderedTitles.unshift(extraToTitle(e));
  }
  for (const t of numberedTitles) {
    orderedTitles.push(t);
  }
  for (const e of endExtras) {
    orderedTitles.push(extraToTitle(e));
  }

  const pairs = densifyPositions(orderedTitles.map((title, idx) => ({ id: String(idx), title })));
  return orderedTitles.map((title, idx) => ({
    bookId,
    title,
    position: pairs[idx].position,
    status: "pending" as const,
  }));
}
