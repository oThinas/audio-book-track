import { seedInMemoryBook } from "@tests/helpers/seed";
import { NoOpUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { InMemoryBookRepository } from "@tests/repositories/in-memory-book-repository";
import { InMemoryChapterRepository } from "@tests/repositories/in-memory-chapter-repository";
import { InMemoryEditorRepository } from "@tests/repositories/in-memory-editor-repository";
import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { updateBookSchema } from "@/lib/schemas/book";
import { BookService } from "@/lib/services/book-service";

describe("BookService.update — pdfUrl", () => {
  let bookRepo: InMemoryBookRepository;
  let chapterRepo: InMemoryChapterRepository;
  let studioRepo: InMemoryStudioRepository;
  let narratorRepo: InMemoryNarratorRepository;
  let editorRepo: InMemoryEditorRepository;
  let service: BookService;

  beforeEach(() => {
    chapterRepo = new InMemoryChapterRepository();
    studioRepo = new InMemoryStudioRepository();
    narratorRepo = new InMemoryNarratorRepository();
    editorRepo = new InMemoryEditorRepository();
    bookRepo = new InMemoryBookRepository({ chapterRepo, studioRepo });
    service = new BookService({
      bookRepo,
      chapterRepo,
      studioRepo,
      narratorRepo,
      editorRepo,
      uow: new NoOpUnitOfWork(),
    });
  });

  it("persists the pdfUrl when provided as an https URL", async () => {
    const { book } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending"],
    });

    await service.update(book.id, { pdfUrl: "https://example.com/livro.pdf" });

    const refreshed = await bookRepo.findById(book.id);
    expect(refreshed?.pdfUrl).toBe("https://example.com/livro.pdf");
  });

  it("persists the pdfUrl when provided as an http URL", async () => {
    const { book } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending"],
    });

    await service.update(book.id, { pdfUrl: "http://internal.example.com/file.pdf" });

    const refreshed = await bookRepo.findById(book.id);
    expect(refreshed?.pdfUrl).toBe("http://internal.example.com/file.pdf");
  });

  it("clears the pdfUrl when null is passed", async () => {
    const { book } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending"],
    });
    // Primeiro seta uma URL...
    await service.update(book.id, { pdfUrl: "https://example.com/file.pdf" });
    expect((await bookRepo.findById(book.id))?.pdfUrl).toBe("https://example.com/file.pdf");

    // ...depois remove com null.
    await service.update(book.id, { pdfUrl: null });

    const refreshed = await bookRepo.findById(book.id);
    expect(refreshed?.pdfUrl).toBeNull();
  });

  it("does not touch pdfUrl when the field is omitted (undefined)", async () => {
    const { book } = await seedInMemoryBook({
      studioRepo,
      bookRepo,
      chapterRepo,
      statuses: ["pending"],
    });
    await service.update(book.id, { pdfUrl: "https://example.com/file.pdf" });

    // Agora atualiza só o título — pdfUrl deve ser preservada.
    await service.update(book.id, { title: "Novo título" });

    const refreshed = await bookRepo.findById(book.id);
    expect(refreshed?.pdfUrl).toBe("https://example.com/file.pdf");
    expect(refreshed?.title).toBe("Novo título");
  });
});

describe("updateBookSchema — pdfUrl", () => {
  it("accepts an https URL", () => {
    const result = updateBookSchema.safeParse({ pdfUrl: "https://example.com/file.pdf" });
    expect(result.success).toBe(true);
  });

  it("accepts an http URL", () => {
    const result = updateBookSchema.safeParse({ pdfUrl: "http://example.com/file.pdf" });
    expect(result.success).toBe(true);
  });

  it("accepts null (removes the URL)", () => {
    const result = updateBookSchema.safeParse({ pdfUrl: null });
    expect(result.success).toBe(true);
  });

  it("rejects a URL without protocol", () => {
    const result = updateBookSchema.safeParse({ pdfUrl: "example.com/file.pdf" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/http:\/\/ ou https:\/\//);
    }
  });

  it("rejects ftp:// or other non-http(s) protocols", () => {
    const result = updateBookSchema.safeParse({ pdfUrl: "ftp://example.com/file.pdf" });
    expect(result.success).toBe(false);
  });

  it("rejects javascript: URLs (XSS guard via regex)", () => {
    const result = updateBookSchema.safeParse({ pdfUrl: "javascript:alert(1)" });
    expect(result.success).toBe(false);
  });

  it("rejects strings longer than 2048 characters", () => {
    const longUrl = `https://example.com/${"a".repeat(2050)}`;
    const result = updateBookSchema.safeParse({ pdfUrl: longUrl });
    expect(result.success).toBe(false);
  });

  it("rejects empty string (use null to remove instead)", () => {
    const result = updateBookSchema.safeParse({ pdfUrl: "" });
    expect(result.success).toBe(false);
  });

  it("trims whitespace before validating", () => {
    const result = updateBookSchema.safeParse({ pdfUrl: "  https://example.com/file.pdf  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pdfUrl).toBe("https://example.com/file.pdf");
    }
  });

  it("considers pdfUrl alone enough to satisfy 'pelo menos um campo'", () => {
    const result = updateBookSchema.safeParse({ pdfUrl: "https://example.com/x.pdf" });
    expect(result.success).toBe(true);
  });

  it("considers pdfUrl: null alone enough to satisfy 'pelo menos um campo'", () => {
    const result = updateBookSchema.safeParse({ pdfUrl: null });
    expect(result.success).toBe(true);
  });
});
