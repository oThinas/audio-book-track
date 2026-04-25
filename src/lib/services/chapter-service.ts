import type { BookStatus } from "@/lib/domain/book";
import type { Chapter, ChapterStatus } from "@/lib/domain/chapter";
import { isValidTransition } from "@/lib/domain/chapter-state-machine";
import {
  ChapterEditorOrSecondsRequiredError,
  ChapterInvalidTransitionError,
  ChapterNarratorRequiredError,
  ChapterNotFoundError,
  ChapterPaidLockedError,
  ChapterReversionConfirmationRequiredError,
} from "@/lib/errors/chapter-errors";
import { EditorNotFoundError } from "@/lib/errors/editor-errors";
import { NarratorNotFoundError } from "@/lib/errors/narrator-errors";
import type { BookRepository, RepositoryTx } from "@/lib/repositories/book-repository";
import type { ChapterRepository } from "@/lib/repositories/chapter-repository";
import type { EditorRepository } from "@/lib/repositories/editor-repository";
import type { NarratorRepository } from "@/lib/repositories/narrator-repository";
import type { UnitOfWork } from "@/lib/repositories/unit-of-work";

import { recomputeBookStatus } from "./book-status-recompute";

export interface ChapterServiceDeps {
  readonly bookRepo: BookRepository;
  readonly chapterRepo: ChapterRepository;
  readonly narratorRepo: NarratorRepository;
  readonly editorRepo: EditorRepository;
  readonly uow?: UnitOfWork;
}

export interface UpdateChapterServiceInput {
  readonly status?: ChapterStatus;
  readonly narratorId?: string | null;
  readonly editorId?: string | null;
  readonly editedSeconds?: number;
  readonly confirmReversion?: boolean;
}

export interface UpdateChapterResult {
  readonly chapter: Chapter;
  readonly bookStatus: BookStatus;
}

export interface DeleteChapterResult {
  readonly bookId: string;
  readonly bookDeleted: boolean;
  readonly bookStatus: BookStatus | null;
}

const PAID_LOCKED_FIELDS = ["narratorId", "editorId", "editedSeconds"] as const;

export class ChapterService {
  constructor(protected readonly deps: ChapterServiceDeps) {}

  async update(chapterId: string, input: UpdateChapterServiceInput): Promise<UpdateChapterResult> {
    const current = await this.deps.chapterRepo.findById(chapterId);
    if (!current) {
      throw new ChapterNotFoundError(chapterId);
    }

    if (current.status === "paid") {
      this.assertPaidLocked(input);
      this.assertReversion(current.status, input);
    } else if (input.status !== undefined && input.status !== current.status) {
      this.assertTransition(current, input);
    }

    await this.assertReferences(input);

    const run = async (tx?: RepositoryTx): Promise<UpdateChapterResult> => {
      const updated = await this.deps.chapterRepo.update(
        chapterId,
        {
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.narratorId !== undefined ? { narratorId: input.narratorId } : {}),
          ...(input.editorId !== undefined ? { editorId: input.editorId } : {}),
          ...(input.editedSeconds !== undefined ? { editedSeconds: input.editedSeconds } : {}),
        },
        tx,
      );

      const book = await recomputeBookStatus(
        updated.bookId,
        { bookRepo: this.deps.bookRepo, chapterRepo: this.deps.chapterRepo },
        tx,
      );

      return { chapter: updated, bookStatus: book.status };
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

      const remaining = await this.deps.chapterRepo.listByBookId(current.bookId, tx);
      if (remaining.length === 0) {
        await this.deps.bookRepo.delete(current.bookId, tx);
        return { bookId: current.bookId, bookDeleted: true, bookStatus: null };
      }

      const book = await recomputeBookStatus(
        current.bookId,
        { bookRepo: this.deps.bookRepo, chapterRepo: this.deps.chapterRepo },
        tx,
      );
      return { bookId: current.bookId, bookDeleted: false, bookStatus: book.status };
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

  private assertReversion(currentStatus: ChapterStatus, input: UpdateChapterServiceInput): void {
    if (input.status === undefined || input.status === currentStatus) {
      return;
    }
    if (input.status !== "completed") {
      throw new ChapterInvalidTransitionError(currentStatus, input.status);
    }
    if (input.confirmReversion !== true) {
      throw new ChapterReversionConfirmationRequiredError();
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
      case "EDITOR_OR_SECONDS_REQUIRED":
        throw new ChapterEditorOrSecondsRequiredError();
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
        throw new NarratorNotFoundError(input.narratorId);
      }
    }
    if (input.editorId !== undefined && input.editorId !== null) {
      const editor = await this.deps.editorRepo.findById(input.editorId);
      if (!editor) {
        throw new EditorNotFoundError(input.editorId);
      }
    }
  }
}
