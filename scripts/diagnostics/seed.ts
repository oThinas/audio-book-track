// Diagnostic seed: guarantees the local (DATABASE_URL) database has the admin
// plus one deterministic book with chapters, so the Lighthouse run can audit
// /books, /books/:id and the settings modal against real content.
//
// Reuses the test factories (createTestBook/createTestChapter) per the
// diagnostics contract §C1. The admin itself is NOT recreated here — signup is
// gated behind E2E_TEST_MODE in auth/server.ts — so we fail fast with a clear
// message and let `bun run db:seed` own admin creation.
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { book } from "@/lib/db/schema";

import {
  createTestBook,
  createTestChapter,
  createTestEditor,
  createTestNarrator,
} from "../../__tests__/helpers/factories";

const ADMIN_EMAIL = "admin@audiobook.local";
const DIAGNOSTIC_BOOK_TITLE = "Diagnóstico — Livro de Baseline";

async function ensureAdminExists(): Promise<void> {
  const admin = await db.query.user.findFirst({
    where: (u, { eq: equals }) => equals(u.email, ADMIN_EMAIL),
    columns: { id: true },
  });
  if (!admin) {
    throw new Error(
      `Admin user (${ADMIN_EMAIL}) not found. Run \`bun run db:seed\` first so the Lighthouse run can log in.`,
    );
  }
}

async function ensureDiagnosticBook(): Promise<void> {
  const existing = await db
    .select({ id: book.id })
    .from(book)
    .where(eq(book.title, DIAGNOSTIC_BOOK_TITLE))
    .limit(1);
  if (existing.length > 0) {
    console.info(`Diagnostic book already present ("${DIAGNOSTIC_BOOK_TITLE}"); skipping.`);
    return;
  }

  const { book: created } = await createTestBook(db, {
    title: DIAGNOSTIC_BOOK_TITLE,
    pricePerHourCents: 9000,
  });
  const { narrator } = await createTestNarrator(db, { name: "Narrador Diagnóstico" });
  const { editor } = await createTestEditor(db, { name: "Editor Diagnóstico" });

  const chapters = [
    { status: "completed" as const, narratorId: narrator.id, editorId: editor.id, edited: 3600 },
    { status: "reviewing" as const, narratorId: narrator.id, editorId: editor.id, edited: 1800 },
    { status: "editing" as const, narratorId: narrator.id, editorId: null, edited: 600 },
    { status: "pending" as const, narratorId: null, editorId: null, edited: 0 },
  ];

  for (let position = 0; position < chapters.length; position += 1) {
    const spec = chapters[position];
    await createTestChapter(db, {
      bookId: created.id,
      position,
      status: spec.status,
      narratorId: spec.narratorId,
      editorId: spec.editorId,
      editedSeconds: spec.edited,
    });
  }

  console.info(
    `Seeded diagnostic book "${DIAGNOSTIC_BOOK_TITLE}" with ${chapters.length} chapters.`,
  );
}

async function main(): Promise<void> {
  await ensureAdminExists();
  await ensureDiagnosticBook();
  process.exit(0);
}

main().catch((error) => {
  console.error("diagnose:seed failed:", error);
  process.exit(1);
});
