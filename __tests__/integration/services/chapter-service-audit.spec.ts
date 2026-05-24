import { getTestDb } from "@tests/helpers/db";
import { createTestBook, createTestChapter } from "@tests/helpers/factories";
import { SavepointUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { describe, expect, it } from "vitest";

import { requestContext } from "@/lib/api/request-context";
import { AUDIT_ACTIONS } from "@/lib/audit/audit-actions";
import { DrizzleAuditLogRepository } from "@/lib/repositories/drizzle/drizzle-audit-log-repository";
import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { AuditServiceImpl } from "@/lib/services/audit-service";
import { ChapterService } from "@/lib/services/chapter-service";

function build() {
  const db = getTestDb();
  const auditRepo = new DrizzleAuditLogRepository(db);
  const service = new ChapterService({
    bookRepo: new DrizzleBookRepository(db),
    chapterRepo: new DrizzleChapterRepository(db),
    narratorRepo: new DrizzleNarratorRepository(db),
    editorRepo: new DrizzleEditorRepository(db),
    uow: new SavepointUnitOfWork(db),
    auditService: new AuditServiceImpl(auditRepo),
  });
  return { service, auditRepo, db };
}

async function inRequest<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return requestContext.run({ requestId: `req-${crypto.randomUUID()}`, userId }, fn);
}

describe("ChapterService — audit trail", () => {
  it("create emits chapter.create with entity_type=chapter", async () => {
    const { service, auditRepo, db } = build();
    const { book } = await createTestBook(db);

    const result = await inRequest("u1", () =>
      service.create(book.id, {
        title: "Cap. 1",
        position: "end",
        expectedVersion: 0,
      }),
    );

    const rows = await auditRepo.findByEntity("chapter", result.chapter.id, 10);
    expect(rows.some((r) => r.action === AUDIT_ACTIONS.CHAPTER_CREATE)).toBe(true);
  });

  it("update emits chapter.update", async () => {
    const { service, auditRepo, db } = build();
    const { book } = await createTestBook(db);
    const { chapter } = await createTestChapter(db, { bookId: book.id, position: 0 });

    await inRequest("u1", () => service.update(chapter.id, { title: "Novo título" }));

    const rows = await auditRepo.findByEntity("chapter", chapter.id, 10);
    expect(rows.some((r) => r.action === AUDIT_ACTIONS.CHAPTER_UPDATE)).toBe(true);
  });

  it("status transition emits chapter.status.transitioned", async () => {
    const { service, auditRepo, db } = build();
    const { book } = await createTestBook(db);
    const narratorId = `narrator-${crypto.randomUUID()}`;
    const { sql } = await import("drizzle-orm");
    await db.execute(
      sql`INSERT INTO narrator (id, name) VALUES (${narratorId}, ${`N-${narratorId}`})`,
    );
    const { chapter } = await createTestChapter(db, {
      bookId: book.id,
      position: 0,
      narratorId,
    });

    await inRequest("u1", () => service.update(chapter.id, { status: "editing" }));

    const rows = await auditRepo.findByEntity("chapter", chapter.id, 10);
    expect(rows.some((r) => r.action === AUDIT_ACTIONS.CHAPTER_STATUS_TRANSITION)).toBe(true);
  });

  it("bulkDelete emits one chapter.bulk_delete row on entity_type=book", async () => {
    const { service, auditRepo, db } = build();
    const { book } = await createTestBook(db);
    const { chapter: c1 } = await createTestChapter(db, { bookId: book.id, position: 0 });
    const { chapter: c2 } = await createTestChapter(db, { bookId: book.id, position: 1 });
    await createTestChapter(db, { bookId: book.id, position: 2 });

    await inRequest("u1", () => service.bulkDelete(book.id, [c1.id, c2.id]));

    const rows = await auditRepo.findByEntity("book", book.id, 10);
    const bulkRows = rows.filter((r) => r.action === AUDIT_ACTIONS.CHAPTER_BULK_DELETE);
    expect(bulkRows).toHaveLength(1);
    const perChapterDeletes = await auditRepo.findByEntity("chapter", c1.id, 10);
    expect(perChapterDeletes.some((r) => r.action === AUDIT_ACTIONS.CHAPTER_DELETE)).toBe(false);
  });

  it("reorder emits one chapter.reorder row on entity_type=book", async () => {
    const { service, auditRepo, db } = build();
    const { book } = await createTestBook(db);
    const { chapter: c1 } = await createTestChapter(db, { bookId: book.id, position: 0 });
    const { chapter: c2 } = await createTestChapter(db, { bookId: book.id, position: 1 });

    // expectedVersion must match book.chaptersVersion right now
    const { sql } = await import("drizzle-orm");
    const versionResult = await db.execute(
      sql`SELECT chapters_version FROM book WHERE id = ${book.id}`,
    );
    const expectedVersion = Number(
      (versionResult.rows[0] as { chapters_version: number }).chapters_version,
    );

    await inRequest("u1", () => service.reorder(book.id, [c2.id, c1.id], expectedVersion));

    const rows = await auditRepo.findByEntity("book", book.id, 10);
    expect(rows.filter((r) => r.action === AUDIT_ACTIONS.CHAPTER_REORDER)).toHaveLength(1);
  });
});
