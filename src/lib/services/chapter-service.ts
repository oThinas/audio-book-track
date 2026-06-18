import { getCurrentUserId } from "@/lib/api/request-context";
import { AUDIT_ACTIONS, type AuditAction } from "@/lib/audit/audit-actions";
import type { BookStatus } from "@/lib/domain/book";
import type { Chapter, ChapterStatus } from "@/lib/domain/chapter";
import { isValidTransition } from "@/lib/domain/chapter-state-machine";
import { chapterTitleKey } from "@/lib/domain/chapter-title";
import { densifyPositions } from "@/lib/domain/normalize-positions";
import { BookChaptersVersionConflictError, BookNotFoundError } from "@/lib/errors/book-errors";
import {
  ChapterEditedSecondsRequiredError,
  ChapterEditorRequiredError,
  ChapterInvalidTransitionError,
  ChapterNarratorRequiredError,
  ChapterNotFoundError,
  ChapterPaidLockedError,
  ChapterPositionTargetInvalidError,
  ChapterReversionConfirmationRequiredError,
  ChaptersNotInBookError,
  ChaptersOrderMismatchError,
  ChapterTitleAlreadyInUseError,
} from "@/lib/errors/chapter-errors";
import { EditorReferenceInvalidError } from "@/lib/errors/editor-errors";
import { NarratorReferenceInvalidError } from "@/lib/errors/narrator-errors";
import type { BookRepository, RepositoryTx } from "@/lib/repositories/book-repository";
import type { ChapterRepository } from "@/lib/repositories/chapter-repository";
import type { EditorRepository } from "@/lib/repositories/editor-repository";
import type { NarratorRepository } from "@/lib/repositories/narrator-repository";
import type { UnitOfWork } from "@/lib/repositories/unit-of-work";
import type { AuditService } from "@/lib/services/audit-service";

import { recomputeBookStatusAndBumpVersion } from "./book-status-recompute";

export interface ChapterServiceDeps {
  readonly bookRepo: BookRepository;
  readonly chapterRepo: ChapterRepository;
  readonly narratorRepo: NarratorRepository;
  readonly editorRepo: EditorRepository;
  readonly uow?: UnitOfWork;
  readonly auditService?: AuditService;
}

export interface UpdateChapterServiceInput {
  readonly title?: string;
  readonly status?: ChapterStatus;
  readonly narratorId?: string | null;
  readonly editorId?: string | null;
  readonly editedSeconds?: number;
  readonly deadline?: string | null;
  readonly confirmReversion?: boolean;
}

export interface UpdateChapterResult {
  readonly chapter: Chapter;
  readonly bookStatus: BookStatus;
  readonly chaptersVersion: number;
}

export interface DeleteChapterResult {
  readonly bookId: string;
  readonly bookDeleted: boolean;
  readonly bookStatus: BookStatus | null;
  readonly chaptersVersion: number | null;
}

export interface BulkDeleteChaptersResult {
  readonly bookId: string;
  readonly bookDeleted: boolean;
  readonly bookStatus: BookStatus | null;
  readonly deletedCount: number;
  readonly chaptersVersion: number | null;
}

export interface ReorderChaptersResult {
  readonly chaptersVersion: number;
}

export type CreateChapterPositionTarget = "start" | "end" | { readonly after: string };

export interface CreateChapterServiceInput {
  readonly title: string;
  readonly position: CreateChapterPositionTarget;
  readonly expectedVersion: number;
}

export interface CreateChapterResult {
  readonly chapter: Chapter;
  readonly bookStatus: BookStatus;
  readonly chaptersVersion: number;
}

// `status` is intentionally absent: a paid chapter must still be revertible to
// completed. That edge is not unguarded — `assertTransition` always runs after
// `assertPaidLocked` and `isValidTransition` rejects every `paid → *` target
// except `completed` (with confirmReversion). Keep both guards in `update()`.
const PAID_LOCKED_FIELDS = [
  "title",
  "narratorId",
  "editorId",
  "editedSeconds",
  "deadline",
] as const;

export class ChapterService {
  constructor(protected readonly deps: ChapterServiceDeps) {}

  private async recordAudit(
    tx: RepositoryTx | undefined,
    action: AuditAction,
    entityType: "chapter" | "book",
    entityId: string,
  ): Promise<void> {
    if (!this.deps.auditService) return;
    await this.deps.auditService.recordWithin(tx, {
      action,
      userId: getCurrentUserId(),
      entityType,
      entityId,
    });
  }

  async update(chapterId: string, input: UpdateChapterServiceInput): Promise<UpdateChapterResult> {
    const current = await this.deps.chapterRepo.findById(chapterId);
    if (!current) {
      throw new ChapterNotFoundError(chapterId);
    }

    if (current.status === "paid") {
      this.assertPaidLocked(input);
    }
    if (input.status !== undefined && input.status !== current.status) {
      this.assertTransition(current, input);
    }

    await this.assertReferences(input);

    if (input.title !== undefined) {
      const trimmed = input.title.trim();
      const siblings = await this.deps.chapterRepo.listByBookId(current.bookId);
      const targetKey = chapterTitleKey(trimmed);
      const collision = siblings.find(
        (c) => c.id !== chapterId && chapterTitleKey(c.title) === targetKey,
      );
      if (collision) {
        throw new ChapterTitleAlreadyInUseError(current.bookId, trimmed);
      }
    }

    const run = async (tx?: RepositoryTx): Promise<UpdateChapterResult> => {
      const now = new Date();
      const targetStatus = input.status ?? current.status;
      const setCompletedAt =
        targetStatus === "completed" && current.completedAt === null
          ? { completedAt: now }
          : targetStatus === "paid" && current.completedAt === null
            ? { completedAt: now }
            : {};
      const setPaidAt = targetStatus === "paid" && current.paidAt === null ? { paidAt: now } : {};

      const updated = await this.deps.chapterRepo.update(
        chapterId,
        {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.narratorId !== undefined ? { narratorId: input.narratorId } : {}),
          ...(input.editorId !== undefined ? { editorId: input.editorId } : {}),
          ...(input.editedSeconds !== undefined ? { editedSeconds: input.editedSeconds } : {}),
          ...(input.deadline !== undefined ? { deadline: input.deadline } : {}),
          ...setCompletedAt,
          ...setPaidAt,
        },
        tx,
      );

      const book = await recomputeBookStatusAndBumpVersion(
        updated.bookId,
        { bookRepo: this.deps.bookRepo, chapterRepo: this.deps.chapterRepo },
        tx,
      );

      const isStatusTransition = input.status !== undefined && input.status !== current.status;
      await this.recordAudit(
        tx,
        isStatusTransition ? AUDIT_ACTIONS.CHAPTER_STATUS_TRANSITION : AUDIT_ACTIONS.CHAPTER_UPDATE,
        "chapter",
        chapterId,
      );

      return { chapter: updated, bookStatus: book.status, chaptersVersion: book.chaptersVersion };
    };

    if (this.deps.uow) {
      return this.deps.uow.transaction(run);
    }
    return run();
  }

  async delete(chapterId: string): Promise<DeleteChapterResult> {
    const current = await this.deps.chapterRepo.findById(chapterId);
    if (!current) {
      throw new ChapterNotFoundError(chapterId);
    }
    if (current.status === "paid") {
      throw new ChapterPaidLockedError(chapterId);
    }

    const run = async (tx?: RepositoryTx): Promise<DeleteChapterResult> => {
      await this.deps.chapterRepo.delete(chapterId, tx);
      await this.recordAudit(tx, AUDIT_ACTIONS.CHAPTER_DELETE, "chapter", chapterId);

      const remaining = await this.deps.chapterRepo.listByBookId(current.bookId, tx);
      if (remaining.length === 0) {
        await this.deps.bookRepo.delete(current.bookId, tx);
        await this.recordAudit(tx, AUDIT_ACTIONS.BOOK_DELETE, "book", current.bookId);
        return {
          bookId: current.bookId,
          bookDeleted: true,
          bookStatus: null,
          chaptersVersion: null,
        };
      }

      const book = await recomputeBookStatusAndBumpVersion(
        current.bookId,
        { bookRepo: this.deps.bookRepo, chapterRepo: this.deps.chapterRepo },
        tx,
      );
      return {
        bookId: current.bookId,
        bookDeleted: false,
        bookStatus: book.status,
        chaptersVersion: book.chaptersVersion,
      };
    };

    if (this.deps.uow) {
      return this.deps.uow.transaction(run);
    }
    return run();
  }

  async bulkDelete(
    bookId: string,
    chapterIds: ReadonlyArray<string>,
  ): Promise<BulkDeleteChaptersResult> {
    const book = await this.deps.bookRepo.findById(bookId);
    if (!book) {
      throw new BookNotFoundError(bookId);
    }

    const uniqueIds = Array.from(new Set(chapterIds));
    const allChapters = await this.deps.chapterRepo.listByBookId(bookId);
    const ownedIds = new Set(allChapters.map((c) => c.id));

    const foreignIds = uniqueIds.filter((id) => !ownedIds.has(id));
    if (foreignIds.length > 0) {
      throw new ChaptersNotInBookError(bookId, foreignIds);
    }

    const targets = allChapters.filter((c) => uniqueIds.includes(c.id));
    if (targets.some((c) => c.status === "paid")) {
      throw new ChapterPaidLockedError(bookId);
    }

    const run = async (tx?: RepositoryTx): Promise<BulkDeleteChaptersResult> => {
      const deletedCount = await this.deps.chapterRepo.deleteMany(uniqueIds, tx);
      await this.recordAudit(tx, AUDIT_ACTIONS.CHAPTER_BULK_DELETE, "book", bookId);

      const remaining = await this.deps.chapterRepo.listByBookId(bookId, tx);
      if (remaining.length === 0) {
        await this.deps.bookRepo.delete(bookId, tx);
        await this.recordAudit(tx, AUDIT_ACTIONS.BOOK_DELETE, "book", bookId);
        return { bookId, bookDeleted: true, bookStatus: null, deletedCount, chaptersVersion: null };
      }

      const refreshed = await recomputeBookStatusAndBumpVersion(
        bookId,
        { bookRepo: this.deps.bookRepo, chapterRepo: this.deps.chapterRepo },
        tx,
      );
      return {
        bookId,
        bookDeleted: false,
        bookStatus: refreshed.status,
        deletedCount,
        chaptersVersion: refreshed.chaptersVersion,
      };
    };

    if (this.deps.uow) {
      return this.deps.uow.transaction(run);
    }
    return run();
  }

  async create(bookId: string, input: CreateChapterServiceInput): Promise<CreateChapterResult> {
    const book = await this.deps.bookRepo.findById(bookId);
    if (!book) {
      throw new BookNotFoundError(bookId);
    }

    const run = async (tx?: RepositoryTx): Promise<CreateChapterResult> => {
      const currentBook = await this.deps.bookRepo.findById(bookId, tx);
      if (!currentBook) {
        throw new BookNotFoundError(bookId);
      }
      if (currentBook.chaptersVersion !== input.expectedVersion) {
        throw new BookChaptersVersionConflictError(
          bookId,
          input.expectedVersion,
          currentBook.chaptersVersion,
        );
      }

      const chapters = await this.deps.chapterRepo.listByBookId(bookId, tx);

      const trimmedTitle = input.title.trim();
      const targetKey = chapterTitleKey(trimmedTitle);
      if (chapters.some((c) => chapterTitleKey(c.title) === targetKey)) {
        throw new ChapterTitleAlreadyInUseError(bookId, trimmedTitle);
      }

      let targetIndex: number;
      if (input.position === "start") {
        targetIndex = 0;
      } else if (input.position === "end") {
        targetIndex = chapters.length;
      } else {
        const afterId = input.position.after;
        const idx = chapters.findIndex((c) => c.id === afterId);
        if (idx < 0) {
          throw new ChapterPositionTargetInvalidError(afterId);
        }
        targetIndex = idx + 1;
      }

      const newChapters = [...chapters];
      const [inserted] = await this.deps.chapterRepo.insertMany(
        [
          {
            bookId,
            title: input.title,
            position: targetIndex,
            status: "pending",
          },
        ],
        tx,
      );
      newChapters.splice(targetIndex, 0, inserted);

      const pairs = densifyPositions(newChapters.map((c) => ({ id: c.id })));
      await this.deps.chapterRepo.reorder(bookId, pairs, tx);

      const refreshed = await recomputeBookStatusAndBumpVersion(
        bookId,
        { bookRepo: this.deps.bookRepo, chapterRepo: this.deps.chapterRepo },
        tx,
      );

      const reloaded = await this.deps.chapterRepo.findById(inserted.id, tx);
      await this.recordAudit(tx, AUDIT_ACTIONS.CHAPTER_CREATE, "chapter", inserted.id);
      return {
        chapter: reloaded ?? inserted,
        bookStatus: refreshed.status,
        chaptersVersion: refreshed.chaptersVersion,
      };
    };

    if (this.deps.uow) {
      return this.deps.uow.transaction(run);
    }
    return run();
  }

  async reorder(
    bookId: string,
    orderedIds: ReadonlyArray<string>,
    expectedVersion: number,
  ): Promise<ReorderChaptersResult> {
    const book = await this.deps.bookRepo.findById(bookId);
    if (!book) {
      throw new BookNotFoundError(bookId);
    }

    const run = async (tx?: RepositoryTx): Promise<ReorderChaptersResult> => {
      const currentBook = await this.deps.bookRepo.findById(bookId, tx);
      if (!currentBook) {
        throw new BookNotFoundError(bookId);
      }
      if (currentBook.chaptersVersion !== expectedVersion) {
        throw new BookChaptersVersionConflictError(
          bookId,
          expectedVersion,
          currentBook.chaptersVersion,
        );
      }

      const chapters = await this.deps.chapterRepo.listByBookId(bookId, tx);
      const currentIds = new Set(chapters.map((c) => c.id));
      const orderedSet = new Set(orderedIds);
      if (currentIds.size !== orderedSet.size) {
        throw new ChaptersOrderMismatchError(bookId);
      }
      for (const id of orderedIds) {
        if (!currentIds.has(id)) {
          throw new ChaptersOrderMismatchError(bookId);
        }
      }

      const pairs = densifyPositions(orderedIds.map((id) => ({ id })));
      await this.deps.chapterRepo.reorder(bookId, pairs, tx);

      const refreshed = await recomputeBookStatusAndBumpVersion(
        bookId,
        { bookRepo: this.deps.bookRepo, chapterRepo: this.deps.chapterRepo },
        tx,
      );
      await this.recordAudit(tx, AUDIT_ACTIONS.CHAPTER_REORDER, "book", bookId);
      return { chaptersVersion: refreshed.chaptersVersion };
    };

    if (this.deps.uow) {
      return this.deps.uow.transaction(run);
    }
    return run();
  }

  private assertPaidLocked(input: UpdateChapterServiceInput): void {
    for (const field of PAID_LOCKED_FIELDS) {
      if (input[field] !== undefined) {
        throw new ChapterPaidLockedError(field);
      }
    }
  }

  private assertTransition(current: Chapter, input: UpdateChapterServiceInput): void {
    const target = input.status as ChapterStatus;
    const result = isValidTransition(current.status, target, {
      narratorId: input.narratorId !== undefined ? input.narratorId : current.narratorId,
      editorId: input.editorId !== undefined ? input.editorId : current.editorId,
      editedSeconds:
        input.editedSeconds !== undefined ? input.editedSeconds : current.editedSeconds,
      confirmReversion: input.confirmReversion,
    });

    if (result.valid) return;

    switch (result.reason) {
      case "NARRATOR_REQUIRED":
        throw new ChapterNarratorRequiredError();
      case "EDITOR_REQUIRED":
        throw new ChapterEditorRequiredError();
      case "EDITED_SECONDS_REQUIRED":
        throw new ChapterEditedSecondsRequiredError();
      case "REVERSION_CONFIRMATION_REQUIRED":
        throw new ChapterReversionConfirmationRequiredError();
      case "INVALID_STATUS_TRANSITION":
        throw new ChapterInvalidTransitionError(current.status, target);
    }
  }

  private async assertReferences(input: UpdateChapterServiceInput): Promise<void> {
    if (input.narratorId !== undefined && input.narratorId !== null) {
      const narrator = await this.deps.narratorRepo.findById(input.narratorId);
      if (!narrator) {
        throw new NarratorReferenceInvalidError(input.narratorId);
      }
    }
    if (input.editorId !== undefined && input.editorId !== null) {
      const editor = await this.deps.editorRepo.findById(input.editorId);
      if (!editor) {
        throw new EditorReferenceInvalidError(input.editorId);
      }
    }
  }
}
