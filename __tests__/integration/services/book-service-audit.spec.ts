import { getTestDb } from "@tests/helpers/db";
import { createTestStudio } from "@tests/helpers/factories";
import { SavepointUnitOfWork } from "@tests/helpers/test-unit-of-work";
import { describe, expect, it } from "vitest";

import { requestContext } from "@/lib/api/request-context";
import { AUDIT_ACTIONS } from "@/lib/audit/audit-actions";
import { DrizzleAuditLogRepository } from "@/lib/repositories/drizzle/drizzle-audit-log-repository";
import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";
import { DrizzleChapterRepository } from "@/lib/repositories/drizzle/drizzle-chapter-repository";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";
import { AuditServiceImpl } from "@/lib/services/audit-service";
import { BookService } from "@/lib/services/book-service";

function build() {
  const db = getTestDb();
  const auditRepo = new DrizzleAuditLogRepository(db);
  const service = new BookService({
    bookRepo: new DrizzleBookRepository(db),
    chapterRepo: new DrizzleChapterRepository(db),
    studioRepo: new DrizzleStudioRepository(db),
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

describe("BookService — audit trail", () => {
  it("create emits book.create with entity_id=newly created book", async () => {
    const { service, auditRepo, db } = build();
    const { studio } = await createTestStudio(db);

    const result = await inRequest("u1", () =>
      service.create({
        title: "Livro Audit",
        studioId: studio.id,
        pricePerHourCents: 7500,
        chapters: { numbered: 1, extras: [] },
      }),
    );

    const rows = await auditRepo.findByEntity("book", result.book.id, 10);
    expect(rows.some((r) => r.action === AUDIT_ACTIONS.BOOK_CREATE)).toBe(true);
    const createRow = rows.find((r) => r.action === AUDIT_ACTIONS.BOOK_CREATE);
    expect(createRow?.userId).toBe("u1");
  });

  it("update emits book.update", async () => {
    const { service, auditRepo, db } = build();
    const { studio } = await createTestStudio(db);
    const created = await inRequest("u1", () =>
      service.create({
        title: "Livro X",
        studioId: studio.id,
        pricePerHourCents: 7500,
        chapters: { numbered: 1, extras: [] },
      }),
    );

    await inRequest("u1", () => service.update(created.book.id, { title: "Novo Título" }));

    const rows = await auditRepo.findByEntity("book", created.book.id, 10);
    expect(rows.some((r) => r.action === AUDIT_ACTIONS.BOOK_UPDATE)).toBe(true);
  });
});
