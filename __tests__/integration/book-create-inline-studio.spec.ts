import { getTestDb } from "@tests/helpers/db";
import { createTestStudio } from "@tests/helpers/factories";
import { SavepointUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleBooksCreate } from "@/app/api/v1/books/route";
import { handleStudiosCreate } from "@/app/api/v1/studios/route";
import { studio } from "@/lib/db/schema";
import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";
import { BookService } from "@/lib/services/book-service";
import { StudioService } from "@/lib/services/studio-service";

function buildBookDeps(session: { user: { id: string } } | null) {
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

function buildStudioDeps(session: { user: { id: string } } | null) {
  const db = getTestDb();
  const service = new StudioService(new DrizzleStudioRepository(db));
  return {
    getSession: vi.fn().mockResolvedValue(session),
    createService: vi.fn().mockReturnValue(service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
  };
}

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

    // 1. Create the placeholder inline studio.
    const studioResp = await handleStudiosCreate(
      jsonRequest("http://test.local/api/v1/studios", {
        name: `Inline ${crypto.randomUUID().slice(0, 8)}`,
        defaultHourlyRateCents: 1,
        inline: true,
      }),
      buildStudioDeps(session),
    );
    expect(studioResp.status).toBe(201);
    const studioBody = (await studioResp.json()) as {
      data: { id: string; defaultHourlyRateCents: number };
      meta: { reactivated: boolean; rateResetForInline?: true };
    };
    expect(studioBody.data.defaultHourlyRateCents).toBe(1);

    // 2. Create a book referencing the inline studio.
    const bookResp = await handleBooksCreate(
      jsonRequest("http://test.local/api/v1/books", {
        title: "Dom Casmurro",
        studioId: studioBody.data.id,
        inlineStudioId: studioBody.data.id,
        pricePerHourCents: 7500,
        numChapters: 3,
      }),
      buildBookDeps(session),
    );
    expect(bookResp.status).toBe(201);
    const bookBody = (await bookResp.json()) as {
      data: { id: string; pricePerHourCents: number; chapters: Array<{ number: number }> };
    };
    expect(bookBody.data.pricePerHourCents).toBe(7500);
    expect(bookBody.data.chapters).toHaveLength(3);

    // 3. The studio's defaultHourlyRateCents is now the book's price (atomic propagation).
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

    const response = await handleBooksCreate(
      jsonRequest("http://test.local/api/v1/books", {
        title: "Anti-abuso",
        studioId: created.id,
        inlineStudioId: created.id,
        pricePerHourCents: 7500,
        numChapters: 1,
      }),
      buildBookDeps({ user: { id: userId } }),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("INLINE_STUDIO_INVALID");

    // Studio was not mutated.
    const [unchanged] = await db.select().from(studio).where(eq(studio.id, created.id));
    expect(unchanged.defaultHourlyRateCents).toBe(5000);
  });

  it("returns meta.rateResetForInline=true when reactivating a soft-deleted studio with inline=true", async () => {
    const db = getTestDb();
    const session = { user: { id: userId } };
    const uniqueName = `Reativar ${crypto.randomUUID().slice(0, 8)}`;

    // Seed an existing studio with a high historical rate, then soft-delete it.
    const { studio: original } = await createTestStudio(db, {
      name: uniqueName,
      defaultHourlyRateCents: 9999,
    });
    await db.update(studio).set({ deletedAt: new Date() }).where(eq(studio.id, original.id));

    const response = await handleStudiosCreate(
      jsonRequest("http://test.local/api/v1/studios", {
        name: uniqueName,
        defaultHourlyRateCents: 1,
        inline: true,
      }),
      buildStudioDeps(session),
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
