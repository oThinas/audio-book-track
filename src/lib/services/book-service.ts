import type { Book, BookStatus } from "@/lib/domain/book";
import type { Chapter, ChapterStatus } from "@/lib/domain/chapter";
import { computeEarningsCents } from "@/lib/domain/earnings";
import { BookStudioNotFoundError } from "@/lib/errors/book-errors";
import type { BookRepository, BookSummary } from "@/lib/repositories/book-repository";
import type { ChapterRepository } from "@/lib/repositories/chapter-repository";
import type { EditorRepository } from "@/lib/repositories/editor-repository";
import type { NarratorRepository } from "@/lib/repositories/narrator-repository";
import type { StudioRepository } from "@/lib/repositories/studio-repository";
import type { UnitOfWork } from "@/lib/repositories/unit-of-work";

import { recomputeBookStatus } from "./book-status-recompute";

export interface BookServiceDeps {
  readonly bookRepo: BookRepository;
  readonly chapterRepo: ChapterRepository;
  readonly studioRepo: StudioRepository;
  readonly narratorRepo: NarratorRepository;
  readonly editorRepo: EditorRepository;
  readonly uow: UnitOfWork;
}

export interface CreateBookServiceInput {
  readonly title: string;
  readonly studioId: string;
  readonly pricePerHourCents: number;
  readonly numChapters: number;
}

export interface CreateBookResult {
  readonly book: Book;
  readonly chapters: readonly Chapter[];
}

export interface BookChapterDetail {
  readonly id: string;
  readonly number: number;
  readonly status: ChapterStatus;
  readonly narrator: { readonly id: string; readonly name: string } | null;
  readonly editor: { readonly id: string; readonly name: string } | null;
  readonly editedSeconds: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface BookDetail {
  readonly id: string;
  readonly title: string;
  readonly studio: { readonly id: string; readonly name: string };
  readonly pricePerHourCents: number;
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
    return this.deps.bookRepo.listSummaries();
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
        number: chapter.number,
        status: chapter.status,
        narrator: chapter.narratorId ? (narratorMap.get(chapter.narratorId) ?? null) : null,
        editor: chapter.editorId ? (editorMap.get(chapter.editorId) ?? null) : null,
        editedSeconds: chapter.editedSeconds,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
      };
    });

    return {
      id: book.id,
      title: book.title,
      studio: { id: studio.id, name: studio.name },
      pricePerHourCents: book.pricePerHourCents,
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
    const studio = await this.deps.studioRepo.findById(input.studioId);
    if (!studio) {
      throw new BookStudioNotFoundError(input.studioId);
    }

    return this.deps.uow.transaction(async (tx) => {
      const inserted = await this.deps.bookRepo.insert(
        {
          title: input.title,
          studioId: input.studioId,
          pricePerHourCents: input.pricePerHourCents,
        },
        tx,
      );

      const chapters = await this.deps.chapterRepo.insertMany(
        Array.from({ length: input.numChapters }, (_, index) => ({
          bookId: inserted.id,
          number: index + 1,
          status: "pending" as const,
        })),
        tx,
      );

      const withStatus = await recomputeBookStatus(
        inserted.id,
        { bookRepo: this.deps.bookRepo, chapterRepo: this.deps.chapterRepo },
        tx,
      );

      return { book: withStatus, chapters };
    });
  }
}
