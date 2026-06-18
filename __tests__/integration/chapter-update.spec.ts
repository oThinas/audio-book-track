import { getTestDb } from "@tests/helpers/db";
import {
  createTestBook,
  createTestChapter,
  createTestEditor,
  createTestNarrator,
} from "@tests/helpers/factories";
import { wrapForTest } from "@tests/helpers/route-context";
import { describe, expect, it } from "vitest";

import { type ChapterByIdRouteDeps, handleChapterUpdate } from "@/app/api/v1/chapters/[id]/route";
import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { ChapterService } from "@/lib/services/chapter-service";

function buildTestRouteDeps(): ChapterByIdRouteDeps {
  const db = getTestDb();
  const service = new ChapterService({
    bookRepo: new DrizzleBookRepository(db),
    chapterRepo: new DrizzleChapterRepository(db),
    narratorRepo: new DrizzleNarratorRepository(db),
    editorRepo: new DrizzleEditorRepository(db),
  });
  return { createService: () => service };
}

function buildPatch(session: { user: { id: string } } | null) {
  return wrapForTest<{ id: string }>(
    (req, ctx) => handleChapterUpdate(req, ctx, buildTestRouteDeps()),
    { session },
  );
}

function makeRequest(body: unknown): Request {
  return new Request("http://test.local/api/v1/chapters/x", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("PATCH /api/v1/chapters/:id (handleChapterUpdate)", () => {
  const session = { user: { id: crypto.randomUUID() } };

  it("returns 401 when there is no session", async () => {
    const PATCH = buildPatch(null);
    const response = await PATCH(makeRequest({ status: "editing" }), {
      params: Promise.resolve({ id: crypto.randomUUID() }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 422 VALIDATION_ERROR for empty body", async () => {
    const PATCH = buildPatch(session);
    const response = await PATCH(makeRequest({}), {
      params: Promise.resolve({ id: crypto.randomUUID() }),
    });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 CHAPTER_NOT_FOUND when chapter does not exist", async () => {
    const PATCH = buildPatch(session);
    const response = await PATCH(makeRequest({ status: "editing" }), {
      params: Promise.resolve({ id: crypto.randomUUID() }),
    });
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("CHAPTER_NOT_FOUND");
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

    const PATCH = buildPatch(session);
    const response = await PATCH(makeRequest({ status: "editing", narratorId: narrator.id }), {
      params: Promise.resolve({ id: chapter.id }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { status: string; narratorId: string };
      meta: { bookStatus: string };
    };
    expect(body.data.status).toBe("editing");
    expect(body.data.narratorId).toBe(narrator.id);
    expect(body.meta.bookStatus).toBe("editing");
  });

  it("returns meta.chaptersVersion bumped by the mutation", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { narrator } = await createTestNarrator(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "pending",
    });

    const PATCH = buildPatch(session);
    const response = await PATCH(makeRequest({ status: "editing", narratorId: narrator.id }), {
      params: Promise.resolve({ id: chapter.id }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      meta: { bookStatus: string; chaptersVersion: number };
    };
    expect(typeof body.meta.chaptersVersion).toBe("number");
    expect(body.meta.chaptersVersion).toBeGreaterThan(0);
  });

  it("allows a free non-paid transition (pending → reviewing) in a single save", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "pending",
    });

    const PATCH = buildPatch(session);
    const response = await PATCH(makeRequest({ status: "reviewing" }), {
      params: Promise.resolve({ id: chapter.id }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { status: string };
      meta: { bookStatus: string };
    };
    expect(body.data.status).toBe("reviewing");
    expect(body.meta.bookStatus).toBe("reviewing");
  });

  it("returns 422 CHAPTER_NARRATOR_REQUIRED for → completed without narrator", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "reviewing",
      editedSeconds: 3600,
    });

    const PATCH = buildPatch(session);
    const response = await PATCH(makeRequest({ status: "completed" }), {
      params: Promise.resolve({ id: chapter.id }),
    });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("CHAPTER_NARRATOR_REQUIRED");
  });

  it("returns 422 CHAPTER_EDITOR_REQUIRED for → completed once narrator is set", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { narrator } = await createTestNarrator(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "reviewing",
      narratorId: narrator.id,
      editedSeconds: 3600,
    });

    const PATCH = buildPatch(session);
    const response = await PATCH(makeRequest({ status: "completed" }), {
      params: Promise.resolve({ id: chapter.id }),
    });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("CHAPTER_EDITOR_REQUIRED");
  });

  it("returns 422 CHAPTER_EDITED_SECONDS_REQUIRED for → completed with narrator + editor but no minutagem", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { narrator } = await createTestNarrator(db);
    const { editor } = await createTestEditor(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "reviewing",
      narratorId: narrator.id,
      editorId: editor.id,
      editedSeconds: 0,
    });

    const PATCH = buildPatch(session);
    const response = await PATCH(makeRequest({ status: "completed" }), {
      params: Promise.resolve({ id: chapter.id }),
    });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("CHAPTER_EDITED_SECONDS_REQUIRED");
  });

  it("returns 422 CHAPTER_INVALID_TRANSITION for pending → paid (paid only from completed)", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { narrator } = await createTestNarrator(db);
    const { editor } = await createTestEditor(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "pending",
      narratorId: narrator.id,
      editorId: editor.id,
      editedSeconds: 3600,
    });

    const PATCH = buildPatch(session);
    const response = await PATCH(makeRequest({ status: "paid" }), {
      params: Promise.resolve({ id: chapter.id }),
    });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("CHAPTER_INVALID_TRANSITION");
  });

  it("accepts completed → paid when narrator + editor + minutagem are present", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { narrator } = await createTestNarrator(db);
    const { editor } = await createTestEditor(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "completed",
      narratorId: narrator.id,
      editorId: editor.id,
      editedSeconds: 3600,
    });

    const PATCH = buildPatch(session);
    const response = await PATCH(makeRequest({ status: "paid" }), {
      params: Promise.resolve({ id: chapter.id }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { status: string };
      meta: { bookStatus: string };
    };
    expect(body.data.status).toBe("paid");
    expect(body.meta.bookStatus).toBe("paid");
  });

  it("returns 422 CHAPTER_INVALID_TRANSITION for paid → reviewing even with confirmReversion", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "paid",
      editedSeconds: 3600,
    });

    const PATCH = buildPatch(session);
    const response = await PATCH(makeRequest({ status: "reviewing", confirmReversion: true }), {
      params: Promise.resolve({ id: chapter.id }),
    });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("CHAPTER_INVALID_TRANSITION");
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

    const PATCH = buildPatch(session);
    const response = await PATCH(makeRequest({ narratorId: narrator.id }), {
      params: Promise.resolve({ id: chapter.id }),
    });
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

    const PATCH = buildPatch(session);
    const response = await PATCH(makeRequest({ status: "completed" }), {
      params: Promise.resolve({ id: chapter.id }),
    });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("CHAPTER_REVERSION_CONFIRMATION_REQUIRED");
  });

  it("accepts paid → completed with confirmReversion: true", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "paid",
    });

    const PATCH = buildPatch(session);
    const response = await PATCH(makeRequest({ status: "completed", confirmReversion: true }), {
      params: Promise.resolve({ id: chapter.id }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { status: string };
      meta: { bookStatus: string };
    };
    expect(body.data.status).toBe("completed");
    expect(body.meta.bookStatus).toBe("completed");
  });

  it("returns 422 NARRATOR_REFERENCE_INVALID when referenced narrator does not exist", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "pending",
    });

    const PATCH = buildPatch(session);
    const response = await PATCH(
      makeRequest({ status: "editing", narratorId: crypto.randomUUID() }),
      { params: Promise.resolve({ id: chapter.id }) },
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("NARRATOR_REFERENCE_INVALID");
  });

  it("returns 422 EDITOR_REFERENCE_INVALID when referenced editor does not exist", async () => {
    const db = getTestDb();
    const { book } = await createTestBook(db);
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      number: 1,
      status: "editing",
    });

    const PATCH = buildPatch(session);
    const response = await PATCH(makeRequest({ editorId: crypto.randomUUID() }), {
      params: Promise.resolve({ id: chapter.id }),
    });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("EDITOR_REFERENCE_INVALID");
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

    const PATCH = buildPatch(session);
    const response = await PATCH(makeRequest({ editorId: editor.id, editedSeconds: 1800 }), {
      params: Promise.resolve({ id: chapter.id }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { status: string; editorId: string; editedSeconds: number };
    };
    expect(body.data.status).toBe("editing");
    expect(body.data.editorId).toBe(editor.id);
    expect(body.data.editedSeconds).toBe(1800);
  });
});
