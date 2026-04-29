import type { Chapter } from "@/lib/domain/chapter";
import { ChapterNotFoundError, ChapterNumberAlreadyInUseError } from "@/lib/errors/chapter-errors";
import type {
  ChapterRepository,
  InsertChapterInput,
  UpdateChapterInput,
} from "@/lib/repositories/chapter-repository";

export class InMemoryChapterRepository implements ChapterRepository {
  private readonly store = new Map<string, Chapter>();

  async listByBookId(bookId: string): Promise<Chapter[]> {
    return Array.from(this.store.values())
      .filter((c) => c.bookId === bookId)
      .sort((a, b) => a.number - b.number);
  }

  async findById(id: string): Promise<Chapter | null> {
    return this.store.get(id) ?? null;
  }

  async insertMany(inputs: ReadonlyArray<InsertChapterInput>): Promise<Chapter[]> {
    const now = new Date();
    const created: Chapter[] = [];
    for (const input of inputs) {
      if (this.findByBookAndNumber(input.bookId, input.number)) {
        throw new ChapterNumberAlreadyInUseError(input.bookId, input.number);
      }
      const chapter: Chapter = {
        id: crypto.randomUUID(),
        bookId: input.bookId,
        number: input.number,
        status: input.status ?? "pending",
        narratorId: input.narratorId ?? null,
        editorId: input.editorId ?? null,
        editedSeconds: input.editedSeconds ?? 0,
        createdAt: now,
        updatedAt: now,
      };
      this.store.set(chapter.id, chapter);
      created.push(chapter);
    }
    return created;
  }

  async update(id: string, input: UpdateChapterInput): Promise<Chapter> {
    const existing = this.store.get(id);
    if (!existing) {
      throw new ChapterNotFoundError(id);
    }
    const updated: Chapter = {
      ...existing,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.narratorId !== undefined ? { narratorId: input.narratorId } : {}),
      ...(input.editorId !== undefined ? { editorId: input.editorId } : {}),
      ...(input.editedSeconds !== undefined ? { editedSeconds: input.editedSeconds } : {}),
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.store.has(id)) {
      throw new ChapterNotFoundError(id);
    }
    this.store.delete(id);
  }

  async deleteMany(ids: ReadonlyArray<string>): Promise<number> {
    let deleted = 0;
    for (const id of ids) {
      if (this.store.delete(id)) {
        deleted += 1;
      }
    }
    return deleted;
  }

  async countByBookId(bookId: string): Promise<number> {
    let count = 0;
    for (const current of this.store.values()) {
      if (current.bookId === bookId) count += 1;
    }
    return count;
  }

  async maxNumberByBookId(bookId: string): Promise<number> {
    let max = 0;
    for (const current of this.store.values()) {
      if (current.bookId === bookId && current.number > max) {
        max = current.number;
      }
    }
    return max;
  }

  private findByBookAndNumber(bookId: string, number: number): Chapter | null {
    for (const current of this.store.values()) {
      if (current.bookId === bookId && current.number === number) {
        return current;
      }
    }
    return null;
  }
}
