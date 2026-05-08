import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestStudio } from "@tests/helpers/factories";
import { wrapForTest } from "@tests/helpers/route-context";
import { describe, expect, it } from "vitest";

import { handleStudiosList, type StudiosRouteDeps } from "@/app/api/v1/studios/route";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";
import { StudioService } from "@/lib/services/studio-service";

function buildTestRouteDeps(): StudiosRouteDeps {
  const db = getTestDb();
  const service = new StudioService(new DrizzleStudioRepository(db));
  return { createService: () => service };
}

function buildGet(session: { user: { id: string } } | null) {
  return wrapForTest((req, ctx) => handleStudiosList(req, ctx, buildTestRouteDeps()), {
    session,
  });
}

const ROUTE_CTX = { params: Promise.resolve({}) };

function makeRequest(): Request {
  return new Request("http://test.local/api/v1/studios");
}

describe("GET /api/v1/studios — booksCount", () => {
  const session = { user: { id: crypto.randomUUID() } };

  it("returns booksCount=0 for a studio with no books", async () => {
    const db = getTestDb();
    await createTestStudio(db, { name: "Sem Livros" });

    const GET = buildGet(session);
    const response = await GET(makeRequest(), ROUTE_CTX);
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

    const GET = buildGet(session);
    const response = await GET(makeRequest(), ROUTE_CTX);
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

    const GET = buildGet(session);
    const response = await GET(makeRequest(), ROUTE_CTX);
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

    const repo = new DrizzleStudioRepository(db);
    await repo.softDelete(hidden.id);

    await createTestBook(db, { studioId: visible.id, title: "Livro Vis" });

    const GET = buildGet(session);
    const response = await GET(makeRequest(), ROUTE_CTX);
    const body = (await response.json()) as {
      data: Array<{ id: string; name: string; booksCount: number }>;
    };

    expect(body.data.map((s) => s.id)).toContain(visible.id);
    expect(body.data.map((s) => s.id)).not.toContain(hidden.id);
  });
});
