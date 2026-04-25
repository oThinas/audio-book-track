import { getTestDb } from "@tests/helpers/db";
import {
  createTestBook,
  createTestChapter,
  createTestEditor,
  createTestNarrator,
} from "@tests/helpers/factories";
import { describe, expect, it, vi } from "vitest";

import { handleChapterUpdate } from "@/app/api/v1/chapters/[id]/route";
import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { ChapterService } from "@/lib/services/chapter-service";

function createRouteDeps(session: { user: { id: string } } | null) {
  const db = getTestDb();
  const service = new ChapterService({
    bookRepo: new DrizzleBookRepository(db),
    chapterRepo: new DrizzleChapterRepository(db),
    narratorRepo: new DrizzleNarratorRepository(db),
    editorRepo: new DrizzleEditorRepository(db),
  });
  return {
    getSession: vi.fn().mockResolvedValue(session),
    createService: vi.fn().mockReturnValue(service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
  };
}

function makeRequest(body: unknown): Request {
  return new Request("http://test.local/api/v1/chapters/x", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("PATCH /api/v1/chapters/:id (handleChapterUpdate)", () => {
  it("returns 401 when there is no session", async () => {
    const response = await handleChapterUpdate(
      makeRequest({ status: "editing" }),
      crypto.randomUUID(),
      createRouteDeps(null),
    );
    expect(response.status).toBe(401);
  });

  it("returns 422 VALIDATION_ERROR for empty body", async () => {
    const response = await handleChapterUpdate(
      makeRequest({}),
      crypto.randomUUID(),
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 NOT_FOUND when chapter does not exist", async () => {
    const response = await handleChapterUpdate(
      makeRequest({ status: "editing" }),
      crypto.randomUUID(),
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("transitions pending → editing with narrator and recomputes book.status", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { narrator } = await createTestNarrator(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "pending",
    });

    const response = await handleChapterUpdate(
      makeRequest({ status: "editing", narratorId: narrator.id }),
      chapter.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { status: string; narratorId: string };
      meta: { bookStatus: string };
    };
    expect(body.data.status).toBe("editing");
    expect(body.data.narratorId).toBe(narrator.id);
    expect(body.meta.bookStatus).toBe("editing");
  });

  it("returns 422 NARRATOR_REQUIRED for pending → editing without narrator", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "pending",
    });

    const response = await handleChapterUpdate(
      makeRequest({ status: "editing" }),
      chapter.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("NARRATOR_REQUIRED");
  });

  it("returns 422 EDITOR_OR_SECONDS_REQUIRED for editing → reviewing without editor/seconds", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { narrator } = await createTestNarrator(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "editing",
      narratorId: narrator.id,
    });

    const response = await handleChapterUpdate(
      makeRequest({ status: "reviewing" }),
      chapter.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("EDITOR_OR_SECONDS_REQUIRED");
  });

  it("returns 409 CHAPTER_PAID_LOCKED when mutating narrator on a paid chapter", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { narrator } = await createTestNarrator(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "paid",
    });

    const response = await handleChapterUpdate(
      makeRequest({ narratorId: narrator.id }),
      chapter.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("CHAPTER_PAID_LOCKED");
  });

  it("returns 422 REVERSION_CONFIRMATION_REQUIRED for paid → completed without flag", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "paid",
    });

    const response = await handleChapterUpdate(
      makeRequest({ status: "completed" }),
      chapter.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("REVERSION_CONFIRMATION_REQUIRED");
  });

  it("accepts paid → completed with confirmReversion: true", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "paid",
    });

    const response = await handleChapterUpdate(
      makeRequest({ status: "completed", confirmReversion: true }),
      chapter.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { status: string };
      meta: { bookStatus: string };
    };
    expect(body.data.status).toBe("completed");
    expect(body.meta.bookStatus).toBe("completed");
  });

  it("returns 422 NARRATOR_NOT_FOUND when referenced narrator does not exist", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "pending",
    });

    const response = await handleChapterUpdate(
      makeRequest({ status: "editing", narratorId: crypto.randomUUID() }),
      chapter.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("NARRATOR_NOT_FOUND");
  });

  it("returns 422 EDITOR_NOT_FOUND when referenced editor does not exist", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "editing",
    });

    const response = await handleChapterUpdate(
      makeRequest({ editorId: crypto.randomUUID() }),
      chapter.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("EDITOR_NOT_FOUND");
  });

  it("updates editorId/editedSeconds without changing status", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { editor } = await createTestEditor(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "editing",
    });

    const response = await handleChapterUpdate(
      makeRequest({ editorId: editor.id, editedSeconds: 1800 }),
      chapter.id,
      createRouteDeps({ user: { id: crypto.randomUUID() } }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { status: string; editorId: string; editedSeconds: number };
    };
    expect(body.data.status).toBe("editing");
    expect(body.data.editorId).toBe(editor.id);
    expect(body.data.editedSeconds).toBe(1800);
  });
});
