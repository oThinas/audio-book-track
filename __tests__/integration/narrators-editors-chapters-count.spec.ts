import { getTestDb } from "@tests/helpers/db";
import {
  createTestBook,
  createTestChapter,
  createTestEditor,
  createTestNarrator,
  createTestStudio,
} from "@tests/helpers/factories";
import { describe, expect, it, vi } from "vitest";

import { handleEditorsList } from "@/app/api/v1/editors/route";
import { handleNarratorsList } from "@/app/api/v1/narrators/route";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { EditorService } from "@/lib/services/editor-service";
import { NarratorService } from "@/lib/services/narrator-service";

function createNarratorDeps() {
  const db = getTestDb();
  const service = new NarratorService(new DrizzleNarratorRepository(db));
  return {
    getSession: vi.fn().mockResolvedValue({ user: { id: crypto.randomUUID() } }),
    createService: vi.fn().mockReturnValue(service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
  };
}

function createEditorDeps() {
  const db = getTestDb();
  const service = new EditorService(new DrizzleEditorRepository(db));
  return {
    getSession: vi.fn().mockResolvedValue({ user: { id: crypto.randomUUID() } }),
    createService: vi.fn().mockReturnValue(service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
  };
}

describe("GET /api/v1/narrators — chaptersCount", () => {
  it("returns chaptersCount=0 for a narrator with no chapters", async () => {
    const db = getTestDb();
    await createTestNarrator(db, { name: "Sem Capítulos" });

    const response = await handleNarratorsList(createNarratorDeps());
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

    const response = await handleNarratorsList(createNarratorDeps());
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

    const response = await handleNarratorsList(createNarratorDeps());
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

    const response = await handleNarratorsList(createNarratorDeps());
    const body = (await response.json()) as {
      data: Array<{ id: string; name: string }>;
    };

    expect(body.data.map((n) => n.id)).not.toContain(hidden.id);
  });
});

describe("GET /api/v1/editors — chaptersCount (US12)", () => {
  it("returns chaptersCount=0 for an editor with no chapters", async () => {
    const db = getTestDb();
    await createTestEditor(db, { name: "Sem Capítulos" });

    const response = await handleEditorsList(createEditorDeps());
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

    const response = await handleEditorsList(createEditorDeps());
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

    const response = await handleEditorsList(createEditorDeps());
    const body = (await response.json()) as {
      data: Array<{ name: string; chaptersCount: number }>;
    };

    expect(body.data.find((e) => e.name === "Editor A")?.chaptersCount).toBe(1);
    expect(body.data.find((e) => e.name === "Editor B")?.chaptersCount).toBe(2);
  });
});
