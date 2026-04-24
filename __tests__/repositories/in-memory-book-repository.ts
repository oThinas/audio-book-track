import type { Book, BookStatus } from "@/lib/domain/book";
import type {
  BookRepository,
  InsertBookInput,
  UpdateBookInput,
} from "@/lib/domain/book-repository";
import { BookNotFoundError, BookTitleAlreadyInUseError } from "@/lib/errors/book-errors";

export class InMemoryBookRepository implements BookRepository {
  private readonly store = new Map<string, Book>();

  async listByUser(_userId: string): Promise<Book[]> {
    return Array.from(this.store.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async findById(id: string): Promise<Book | null> {
    return this.store.get(id) ?? null;
  }

  async insert(input: InsertBookInput): Promise<Book> {
    const collision = this.findByTitleAndStudio(input.title, input.studioId);
    if (collision) {
      throw new BookTitleAlreadyInUseError(input.title, input.studioId);
    }

    const now = new Date();
    const book: Book = {
      id: crypto.randomUUID(),
      title: input.title,
      studioId: input.studioId,
      pricePerHourCents: input.pricePerHourCents,
      pdfUrl: input.pdfUrl ?? null,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(book.id, book);
    return book;
  }

  async update(id: string, input: UpdateBookInput): Promise<Book> {
    const existing = this.store.get(id);
    if (!existing) {
      throw new BookNotFoundError(id);
    }

    const nextTitle = input.title ?? existing.title;
    const nextStudioId = input.studioId ?? existing.studioId;
    if (
      (input.title !== undefined || input.studioId !== undefined) &&
      (nextTitle !== existing.title || nextStudioId !== existing.studioId)
    ) {
      const duplicate = this.findByTitleAndStudio(nextTitle, nextStudioId);
      if (duplicate && duplicate.id !== id) {
        throw new BookTitleAlreadyInUseError(nextTitle, nextStudioId);
      }
    }

    const updated: Book = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.studioId !== undefined ? { studioId: input.studioId } : {}),
      ...(input.pricePerHourCents !== undefined
        ? { pricePerHourCents: input.pricePerHourCents }
        : {}),
      ...(input.pdfUrl !== undefined ? { pdfUrl: input.pdfUrl } : {}),
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async updateStatus(id: string, status: BookStatus): Promise<Book> {
    const existing = this.store.get(id);
    if (!existing) {
      throw new BookNotFoundError(id);
    }
    const updated: Book = { ...existing, status, updatedAt: new Date() };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.store.has(id)) {
      throw new BookNotFoundError(id);
    }
    this.store.delete(id);
  }

  private findByTitleAndStudio(title: string, studioId: string): Book | null {
    const normalized = title.toLowerCase();
    for (const current of this.store.values()) {
      if (current.studioId === studioId && current.title.toLowerCase() === normalized) {
        return current;
      }
    }
    return null;
  }
}
