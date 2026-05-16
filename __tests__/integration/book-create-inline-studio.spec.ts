import { getTestDb } from "@tests/helpers/db";
import { createTestStudio } from "@tests/helpers/factories";
import { wrapForTest } from "@tests/helpers/route-context";
import { SavepointUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { type BooksRouteDeps, handleBooksCreate } from "@/app/api/v1/books/route";
import { handleStudiosCreate, type StudiosRouteDeps } from "@/app/api/v1/studios/route";
import { studio } from "@/lib/db/schema";
import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";
import { BookService } from "@/lib/services/book-service";
import { StudioService } from "@/lib/services/studio-service";

function buildBookRouteDeps(): BooksRouteDeps {
  const db = getTestDb();
  const service = new BookService({
    bookRepo: new DrizzleBookRepository(db),
    chapterRepo: new DrizzleChapterRepository(db),
    studioRepo: new DrizzleStudioRepository(db),
    narratorRepo: new DrizzleNarratorRepository(db),
    editorRepo: new DrizzleEditorRepository(db),
    uow: new SavepointUnitOfWork(db),
  });
  return { createService: () => service };
}

function buildStudioRouteDeps(): StudiosRouteDeps {
  const db = getTestDb();
  const service = new StudioService(new DrizzleStudioRepository(db));
  return { createService: () => service };
}

function buildBookPost(session: { user: { id: string } } | null) {
  return wrapForTest((req, ctx) => handleBooksCreate(req, ctx, buildBookRouteDeps()), {
    session,
  });
}

function buildStudioPost(session: { user: { id: string } } | null) {
  return wrapForTest((req, ctx) => handleStudiosCreate(req, ctx, buildStudioRouteDeps()), {
    session,
  });
}

const ROUTE_CTX = { params: Promise.resolve({}) };

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Inline studio + book creation flow", () => {
  let userId: string;

  beforeEach(() => {
    userId = crypto.randomUUID();
  });

  it("propagates pricePerHourCents to the inline studio in the same flow", async () => {
    const db = getTestDb();
    const session = { user: { id: userId } };

    const studioPost = buildStudioPost(session);
    const studioResp = await studioPost(
      jsonRequest("http://test.local/api/v1/studios", {
        name: `Inline ${crypto.randomUUID().slice(0, 8)}`,
        defaultHourlyRateCents: 1,
        inline: true,
      }),
      ROUTE_CTX,
    );
    expect(studioResp.status).toBe(201);
    const studioBody = (await studioResp.json()) as {
      data: { id: string; defaultHourlyRateCents: number };
      meta: { reactivated: boolean; rateResetForInline?: true };
    };
    expect(studioBody.data.defaultHourlyRateCents).toBe(1);

    const bookPost = buildBookPost(session);
    const bookResp = await bookPost(
      jsonRequest("http://test.local/api/v1/books", {
        title: "Dom Casmurro",
        studioId: studioBody.data.id,
        inlineStudioId: studioBody.data.id,
        pricePerHourCents: 7500,
        chapters: { numbered: 3, extras: [] },
      }),
      ROUTE_CTX,
    );
    expect(bookResp.status).toBe(201);
    const bookBody = (await bookResp.json()) as {
      data: { id: string; pricePerHourCents: number; chapters: Array<{ number: number }> };
    };
    expect(bookBody.data.pricePerHourCents).toBe(7500);
    expect(bookBody.data.chapters).toHaveLength(3);

    const [refreshedStudio] = await db
      .select()
      .from(studio)
      .where(eq(studio.id, studioBody.data.id));
    expect(refreshedStudio.defaultHourlyRateCents).toBe(7500);
  });

  it("rejects with 422 INLINE_STUDIO_INVALID when the studio's defaultHourlyRateCents is not the placeholder", async () => {
    const db = getTestDb();
    const { studio: created } = await createTestStudio(db, {
      name: "Não-placeholder",
      defaultHourlyRateCents: 5000,
    });

    const bookPost = buildBookPost({ user: { id: userId } });
    const response = await bookPost(
      jsonRequest("http://test.local/api/v1/books", {
        title: "Anti-abuso",
        studioId: created.id,
        inlineStudioId: created.id,
        pricePerHourCents: 7500,
        chapters: { numbered: 1, extras: [] },
      }),
      ROUTE_CTX,
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("INLINE_STUDIO_INVALID");

    const [unchanged] = await db.select().from(studio).where(eq(studio.id, created.id));
    expect(unchanged.defaultHourlyRateCents).toBe(5000);
  });

  it("returns meta.rateResetForInline=true when reactivating a soft-deleted studio with inline=true", async () => {
    const db = getTestDb();
    const session = { user: { id: userId } };
    const uniqueName = `Reativar ${crypto.randomUUID().slice(0, 8)}`;

    const { studio: original } = await createTestStudio(db, {
      name: uniqueName,
      defaultHourlyRateCents: 9999,
    });
    await db.update(studio).set({ deletedAt: new Date() }).where(eq(studio.id, original.id));

    const studioPost = buildStudioPost(session);
    const response = await studioPost(
      jsonRequest("http://test.local/api/v1/studios", {
        name: uniqueName,
        defaultHourlyRateCents: 1,
        inline: true,
      }),
      ROUTE_CTX,
    );
    const body = (await response.json()) as {
      data: { id: string; defaultHourlyRateCents: number };
      meta: { reactivated: boolean; rateResetForInline?: true };
    };

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(original.id);
    expect(body.data.defaultHourlyRateCents).toBe(1);
    expect(body.meta.reactivated).toBe(true);
    expect(body.meta.rateResetForInline).toBe(true);
  });
});
