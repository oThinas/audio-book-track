import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestStudio } from "@tests/helpers/factories";
import { describe, expect, it, vi } from "vitest";

import { handleStudiosList } from "@/app/api/v1/studios/route";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";
import { StudioService } from "@/lib/services/studio-service";

function createDeps() {
  const db = getTestDb();
  const repo = new DrizzleStudioRepository(db);
  const service = new StudioService(repo);
  return {
    getSession: vi.fn().mockResolvedValue({ user: { id: crypto.randomUUID() } }),
    createService: vi.fn().mockReturnValue(service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
  };
}

describe("GET /api/v1/studios — booksCount", () => {
  it("returns booksCount=0 for a studio with no books", async () => {
    const db = getTestDb();
    await createTestStudio(db, { name: "Sem Livros" });

    const response = await handleStudiosList(createDeps());
    const body = (await response.json()) as {
      data: Array<{ name: string; booksCount: number }>;
    };

    const studio = body.data.find((s) => s.name === "Sem Livros");
    expect(studio?.booksCount).toBe(0);
  });

  it("aggregates booksCount via LEFT JOIN — counts every book regardless of chapter status", async () => {
    const db = getTestDb();
    const { studio } = await createTestStudio(db, { name: "Tres Livros" });
    await createTestBook(db, { studioId: studio.id, title: "L1" });
    await createTestBook(db, { studioId: studio.id, title: "L2" });
    await createTestBook(db, { studioId: studio.id, title: "L3" });

    const response = await handleStudiosList(createDeps());
    const body = (await response.json()) as {
      data: Array<{ name: string; booksCount: number }>;
    };

    const found = body.data.find((s) => s.name === "Tres Livros");
    expect(found?.booksCount).toBe(3);
  });

  it("isolates booksCount per studio (no cross-counting)", async () => {
    const db = getTestDb();
    const { studio: a } = await createTestStudio(db, { name: "Studio A" });
    const { studio: b } = await createTestStudio(db, { name: "Studio B" });
    await createTestBook(db, { studioId: a.id, title: "Livro A1" });
    await createTestBook(db, { studioId: a.id, title: "Livro A2" });
    await createTestBook(db, { studioId: b.id, title: "Livro B1" });

    const response = await handleStudiosList(createDeps());
    const body = (await response.json()) as {
      data: Array<{ name: string; booksCount: number }>;
    };

    expect(body.data.find((s) => s.name === "Studio A")?.booksCount).toBe(2);
    expect(body.data.find((s) => s.name === "Studio B")?.booksCount).toBe(1);
  });

  it("does not list soft-deleted studios", async () => {
    const db = getTestDb();
    const { studio: visible } = await createTestStudio(db, { name: "Visível" });
    const { studio: hidden } = await createTestStudio(db, { name: "Oculto" });

    // Soft-delete o estúdio "Oculto" via repo
    const repo = new DrizzleStudioRepository(db);
    await repo.softDelete(hidden.id);

    await createTestBook(db, { studioId: visible.id, title: "Livro Vis" });

    const response = await handleStudiosList(createDeps());
    const body = (await response.json()) as {
      data: Array<{ id: string; name: string; booksCount: number }>;
    };

    expect(body.data.map((s) => s.id)).toContain(visible.id);
    expect(body.data.map((s) => s.id)).not.toContain(hidden.id);
  });
});
