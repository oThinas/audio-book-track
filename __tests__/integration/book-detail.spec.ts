import { getTestDb } from "@tests/helpers/db";
import {
  createTestBook,
  createTestChapter,
  createTestEditor,
  createTestNarrator,
  createTestStudio,
} from "@tests/helpers/factories";
import { SavepointUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleBookDetail } from "@/app/api/v1/books/[id]/route";
import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";
import { BookService } from "@/lib/services/book-service";

function createRouteDeps(session: { user: { id: string } } | null) {
  const db = getTestDb();
  const service = new BookService({
    bookRepo: new DrizzleBookRepository(db),
    chapterRepo: new DrizzleChapterRepository(db),
    studioRepo: new DrizzleStudioRepository(db),
    narratorRepo: new DrizzleNarratorRepository(db),
    editorRepo: new DrizzleEditorRepository(db),
    uow: new SavepointUnitOfWork(db),
  });
  return {
    getSession: vi.fn().mockResolvedValue(session),
    createService: vi.fn().mockReturnValue(service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
  };
}

describe("GET /api/v1/books/:id (handleBookDetail)", () => {
  let userId: string;

  beforeEach(() => {
    userId = crypto.randomUUID();
  });

  it("returns 401 when there is no session", async () => {
    const response = await handleBookDetail(crypto.randomUUID(), createRouteDeps(null));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when the book does not exist", async () => {
    const response = await handleBookDetail(
      crypto.randomUUID(),
      createRouteDeps({ user: { id: userId } }),
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 200 with the full book detail payload", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db, {
      name: "Sonora",
      defaultHourlyRateCents: 7500,
    });
    const { narrator } = await createTestNarrator(db, { name: "Ana Silva" });
    const { editor } = await createTestEditor(db, {
      name: "Bruno Gomes",
      email: `bruno-${crypto.randomUUID().slice(0, 8)}@test.local`,
    });
    const { book } = await createTestBook(db, {
      title: "Dom Casmurro",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "completed",
      narratorId: narrator.id,
      editorId: editor.id,
      editedSeconds: 3600,
    });
    await createTestChapter(db, {
      bookId: book.id,
      number: 2,
      status: "paid",
      narratorId: narrator.id,
      editedSeconds: 7200,
    });
    await createTestChapter(db, {
      bookId: book.id,
      number: 3,
      status: "pending",
      editedSeconds: 0,
    });

    const response = await handleBookDetail(book.id, createRouteDeps({ user: { id: userId } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const body = (await response.json()) as {
      data: {
        id: string;
        title: string;
        studio: { id: string; name: string };
        pricePerHourCents: number;
        pdfUrl: string | null;
        status: string;
        totalChapters: number;
        completedChapters: number;
        totalEarningsCents: number;
        chapters: Array<{
          id: string;
          number: number;
          status: string;
          narrator: { id: string; name: string } | null;
          editor: { id: string; name: string } | null;
          editedSeconds: number;
        }>;
      };
    };

    expect(body.data.id).toBe(book.id);
    expect(body.data.title).toBe("Dom Casmurro");
    expect(body.data.studio).toEqual({ id: studio.id, name: "Sonora" });
    expect(body.data.pricePerHourCents).toBe(7500);
    expect(body.data.totalChapters).toBe(3);
    expect(body.data.completedChapters).toBe(2);
    expect(body.data.totalEarningsCents).toBe(22_500);
    expect(body.data.chapters).toHaveLength(3);

    const [c1, c2, c3] = body.data.chapters;
    expect(c1.number).toBe(1);
    expect(c1.narrator).toEqual({ id: narrator.id, name: "Ana Silva" });
    expect(c1.editor).toEqual({ id: editor.id, name: "Bruno Gomes" });
    expect(c1.editedSeconds).toBe(3600);

    expect(c2.number).toBe(2);
    expect(c2.narrator).toEqual({ id: narrator.id, name: "Ana Silva" });
    expect(c2.editor).toBeNull();

    expect(c3.number).toBe(3);
    expect(c3.narrator).toBeNull();
    expect(c3.editor).toBeNull();
  });

  it("returns the studio name even when the studio is soft-deleted", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db, {
      name: "Legacy Studio",
      defaultHourlyRateCents: 7500,
    });
    const { book } = await createTestBook(db, {
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "paid",
      editedSeconds: 3600,
    });

    await new DrizzleStudioRepository(db).softDelete(studio.id);

    const response = await handleBookDetail(book.id, createRouteDeps({ user: { id: userId } }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { studio: { id: string; name: string } };
    };
    expect(body.data.studio).toEqual({ id: studio.id, name: "Legacy Studio" });
  });
});
