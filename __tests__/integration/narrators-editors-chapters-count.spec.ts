import { getTestDb } from "@tests/helpers/db";
import {
  createTestBook,
  createTestChapter,
  createTestEditor,
  createTestNarrator,
  createTestStudio,
} from "@tests/helpers/factories";
import { wrapForTest } from "@tests/helpers/route-context";
import { describe, expect, it } from "vitest";

import { type EditorsRouteDeps, handleEditorsList } from "@/app/api/v1/editors/route";
import { handleNarratorsList, type NarratorsRouteDeps } from "@/app/api/v1/narrators/route";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { EditorService } from "@/lib/services/editor-service";
import { NarratorService } from "@/lib/services/narrator-service";

function buildNarratorDeps(): NarratorsRouteDeps {
  const db = getTestDb();
  const service = new NarratorService(new DrizzleNarratorRepository(db));
  return { createService: () => service };
}

function buildEditorDeps(): EditorsRouteDeps {
  const db = getTestDb();
  const service = new EditorService(new DrizzleEditorRepository(db));
  return { createService: () => service };
}

function buildNarratorGet(session: { user: { id: string } } | null) {
  return wrapForTest((req, ctx) => handleNarratorsList(req, ctx, buildNarratorDeps()), {
    session,
  });
}

function buildEditorGet(session: { user: { id: string } } | null) {
  return wrapForTest((req, ctx) => handleEditorsList(req, ctx, buildEditorDeps()), { session });
}

const ROUTE_CTX = { params: Promise.resolve({}) };

function makeNarratorRequest(): Request {
  return new Request("http://test.local/api/v1/narrators");
}

function makeEditorRequest(): Request {
  return new Request("http://test.local/api/v1/editors");
}

describe("GET /api/v1/narrators — chaptersCount", () => {
  const session = { user: { id: crypto.randomUUID() } };

  it("returns chaptersCount=0 for a narrator with no chapters", async () => {
    const db = getTestDb();
    await createTestNarrator(db, { name: "Sem Capítulos" });

    const GET = buildNarratorGet(session);
    const response = await GET(makeNarratorRequest(), ROUTE_CTX);
    const body = (await response.json()) as {
      data: Array<{ name: string; chaptersCount: number }>;
    };

    const found = body.data.find((n) => n.name === "Sem Capítulos");
    expect(found?.chaptersCount).toBe(0);
  });

  it("aggregates chaptersCount across multiple chapters and books", async () => {
    const db = getTestDb();
    const { narrator } = await createTestNarrator(db, { name: "Cinco Capítulos" });
    const { studio } = await createTestStudio(db);
    const { book: bookA } = await createTestBook(db, { studioId: studio.id, title: "A" });
    const { book: bookB } = await createTestBook(db, { studioId: studio.id, title: "B" });

    await createTestChapter(db, { bookId: bookA.id, number: 1, narratorId: narrator.id });
    await createTestChapter(db, { bookId: bookA.id, number: 2, narratorId: narrator.id });
    await createTestChapter(db, { bookId: bookB.id, number: 1, narratorId: narrator.id });
    await createTestChapter(db, { bookId: bookB.id, number: 2, narratorId: narrator.id });
    await createTestChapter(db, { bookId: bookB.id, number: 3, narratorId: narrator.id });

    const GET = buildNarratorGet(session);
    const response = await GET(makeNarratorRequest(), ROUTE_CTX);
    const body = (await response.json()) as {
      data: Array<{ name: string; chaptersCount: number }>;
    };

    expect(body.data.find((n) => n.name === "Cinco Capítulos")?.chaptersCount).toBe(5);
  });

  it("isolates chaptersCount per narrator", async () => {
    const db = getTestDb();
    const { narrator: a } = await createTestNarrator(db, { name: "Narrador A" });
    const { narrator: b } = await createTestNarrator(db, { name: "Narrador B" });
    const { studio } = await createTestStudio(db);
    const { book } = await createTestBook(db, { studioId: studio.id });

    await createTestChapter(db, { bookId: book.id, number: 1, narratorId: a.id });
    await createTestChapter(db, { bookId: book.id, number: 2, narratorId: a.id });
    await createTestChapter(db, { bookId: book.id, number: 3, narratorId: b.id });

    const GET = buildNarratorGet(session);
    const response = await GET(makeNarratorRequest(), ROUTE_CTX);
    const body = (await response.json()) as {
      data: Array<{ name: string; chaptersCount: number }>;
    };

    expect(body.data.find((n) => n.name === "Narrador A")?.chaptersCount).toBe(2);
    expect(body.data.find((n) => n.name === "Narrador B")?.chaptersCount).toBe(1);
  });

  it("does not list soft-deleted narrators", async () => {
    const db = getTestDb();
    const { narrator: hidden } = await createTestNarrator(db, { name: "Oculto" });
    await createTestNarrator(db, { name: "Visível" });

    const repo = new DrizzleNarratorRepository(db);
    await repo.softDelete(hidden.id);

    const GET = buildNarratorGet(session);
    const response = await GET(makeNarratorRequest(), ROUTE_CTX);
    const body = (await response.json()) as {
      data: Array<{ id: string; name: string }>;
    };

    expect(body.data.map((n) => n.id)).not.toContain(hidden.id);
  });
});

describe("GET /api/v1/editors — chaptersCount (US12)", () => {
  const session = { user: { id: crypto.randomUUID() } };

  it("returns chaptersCount=0 for an editor with no chapters", async () => {
    const db = getTestDb();
    await createTestEditor(db, { name: "Sem Capítulos" });

    const GET = buildEditorGet(session);
    const response = await GET(makeEditorRequest(), ROUTE_CTX);
    const body = (await response.json()) as {
      data: Array<{ name: string; chaptersCount: number }>;
    };

    expect(body.data.find((e) => e.name === "Sem Capítulos")?.chaptersCount).toBe(0);
  });

  it("aggregates chaptersCount across multiple chapters and books", async () => {
    const db = getTestDb();
    const { editor } = await createTestEditor(db, { name: "Sete Capítulos" });
    const { studio } = await createTestStudio(db);
    const { book: bookA } = await createTestBook(db, { studioId: studio.id, title: "A" });
    const { book: bookB } = await createTestBook(db, { studioId: studio.id, title: "B" });

    for (const num of [1, 2, 3, 4]) {
      await createTestChapter(db, { bookId: bookA.id, number: num, editorId: editor.id });
    }
    for (const num of [1, 2, 3]) {
      await createTestChapter(db, { bookId: bookB.id, number: num, editorId: editor.id });
    }

    const GET = buildEditorGet(session);
    const response = await GET(makeEditorRequest(), ROUTE_CTX);
    const body = (await response.json()) as {
      data: Array<{ name: string; chaptersCount: number }>;
    };

    expect(body.data.find((e) => e.name === "Sete Capítulos")?.chaptersCount).toBe(7);
  });

  it("isolates chaptersCount per editor", async () => {
    const db = getTestDb();
    const { editor: a } = await createTestEditor(db, {
      name: "Editor A",
      email: "a@e.local",
    });
    const { editor: b } = await createTestEditor(db, {
      name: "Editor B",
      email: "b@e.local",
    });
    const { studio } = await createTestStudio(db);
    const { book } = await createTestBook(db, { studioId: studio.id });

    await createTestChapter(db, { bookId: book.id, number: 1, editorId: a.id });
    await createTestChapter(db, { bookId: book.id, number: 2, editorId: b.id });
    await createTestChapter(db, { bookId: book.id, number: 3, editorId: b.id });

    const GET = buildEditorGet(session);
    const response = await GET(makeEditorRequest(), ROUTE_CTX);
    const body = (await response.json()) as {
      data: Array<{ name: string; chaptersCount: number }>;
    };

    expect(body.data.find((e) => e.name === "Editor A")?.chaptersCount).toBe(1);
    expect(body.data.find((e) => e.name === "Editor B")?.chaptersCount).toBe(2);
  });
});
