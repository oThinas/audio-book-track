import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { account, book, chapter, editor, narrator, session, studio, user } from "@/lib/db/schema";
import type { TestDb } from "./db";

interface CreateTestUserOptions {
  readonly name?: string;
  readonly email?: string;
  readonly username?: string;
  readonly password?: string;
}

interface CreateTestUserResult {
  readonly user: typeof user.$inferSelect;
  readonly account: typeof account.$inferSelect;
}

export async function createTestUser(
  db: TestDb,
  overrides: CreateTestUserOptions = {},
): Promise<CreateTestUserResult> {
  const suffix = randomUUID().slice(0, 8);
  const userId = randomUUID();
  const accountId = randomUUID();

  const rawPassword = overrides.password ?? "password123";
  const hashedPassword = await hashPassword(rawPassword);

  const [createdUser] = await db
    .insert(user)
    .values({
      id: userId,
      name: overrides.name ?? "Test User",
      email: overrides.email ?? `test-${suffix}@test.local`,
      emailVerified: false,
      username: overrides.username ?? `testuser-${suffix}`,
      displayUsername: overrides.username ?? `testuser-${suffix}`,
    })
    .returning();

  const [createdAccount] = await db
    .insert(account)
    .values({
      id: accountId,
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashedPassword,
    })
    .returning();

  return { user: createdUser, account: createdAccount };
}

interface CreateTestSessionOptions {
  readonly token?: string;
  readonly expiresAt?: Date;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

interface CreateTestSessionResult {
  readonly session: typeof session.$inferSelect;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function createTestSession(
  db: TestDb,
  userId: string,
  overrides: CreateTestSessionOptions = {},
): Promise<CreateTestSessionResult> {
  const suffix = randomUUID().slice(0, 8);
  const sessionId = randomUUID();

  const [createdSession] = await db
    .insert(session)
    .values({
      id: sessionId,
      token: overrides.token ?? `session-${suffix}`,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + SEVEN_DAYS_MS),
      userId,
      ipAddress: overrides.ipAddress ?? null,
      userAgent: overrides.userAgent ?? null,
    })
    .returning();

  return { session: createdSession };
}

interface CreateTestNarratorOptions {
  readonly name?: string;
}

interface CreateTestNarratorResult {
  readonly narrator: typeof narrator.$inferSelect;
}

export async function createTestNarrator(
  db: TestDb,
  overrides: CreateTestNarratorOptions = {},
): Promise<CreateTestNarratorResult> {
  const suffix = randomUUID().slice(0, 8);

  const [createdNarrator] = await db
    .insert(narrator)
    .values({
      name: overrides.name ?? `Narrator ${suffix}`,
    })
    .returning();

  return { narrator: createdNarrator };
}

interface CreateTestEditorOptions {
  readonly name?: string;
  readonly email?: string;
}

interface CreateTestEditorResult {
  readonly editor: typeof editor.$inferSelect;
}

export async function createTestEditor(
  db: TestDb,
  overrides: CreateTestEditorOptions = {},
): Promise<CreateTestEditorResult> {
  const suffix = randomUUID().slice(0, 8);

  const [createdEditor] = await db
    .insert(editor)
    .values({
      name: overrides.name ?? `Editor ${suffix}`,
      email: overrides.email ?? `editor-${suffix}@test.local`,
    })
    .returning();

  return { editor: createdEditor };
}

interface CreateTestStudioOptions {
  readonly name?: string;
  readonly defaultHourlyRateCents?: number;
}

interface CreateTestStudioResult {
  readonly studio: typeof studio.$inferSelect;
}

export async function createTestStudio(
  db: TestDb,
  overrides: CreateTestStudioOptions = {},
): Promise<CreateTestStudioResult> {
  const suffix = randomUUID().slice(0, 8);

  const [createdStudio] = await db
    .insert(studio)
    .values({
      name: overrides.name ?? `Studio ${suffix}`,
      defaultHourlyRateCents: overrides.defaultHourlyRateCents ?? 8500,
    })
    .returning();

  return { studio: createdStudio };
}

type BookStatus = "pending" | "editing" | "reviewing" | "retake" | "completed" | "paid";

interface CreateTestBookOptions {
  readonly title?: string;
  readonly studioId?: string;
  readonly pricePerHourCents?: number;
  readonly pdfUrl?: string | null;
  readonly status?: BookStatus;
}

interface CreateTestBookResult {
  readonly book: typeof book.$inferSelect;
}

export async function createTestBook(
  db: TestDb,
  overrides: CreateTestBookOptions = {},
): Promise<CreateTestBookResult> {
  const suffix = randomUUID().slice(0, 8);

  const studioId =
    overrides.studioId ??
    (await createTestStudio(db, { name: `Studio for Book ${suffix}` })).studio.id;

  const [createdBook] = await db
    .insert(book)
    .values({
      title: overrides.title ?? `Book ${suffix}`,
      studioId,
      pricePerHourCents: overrides.pricePerHourCents ?? 8500,
      pdfUrl: overrides.pdfUrl ?? null,
      status: overrides.status ?? "pending",
    })
    .returning();

  return { book: createdBook };
}

interface CreateTestChapterOptions {
  readonly bookId?: string;
  readonly number?: number;
  readonly status?: BookStatus;
  readonly narratorId?: string | null;
  readonly editorId?: string | null;
  readonly editedSeconds?: number;
}

interface CreateTestChapterResult {
  readonly chapter: typeof chapter.$inferSelect;
}

export async function createTestChapter(
  db: TestDb,
  overrides: CreateTestChapterOptions = {},
): Promise<CreateTestChapterResult> {
  const bookId = overrides.bookId ?? (await createTestBook(db)).book.id;

  const [createdChapter] = await db
    .insert(chapter)
    .values({
      bookId,
      number: overrides.number ?? 1,
      status: overrides.status ?? "pending",
      narratorId: overrides.narratorId ?? null,
      editorId: overrides.editorId ?? null,
      editedSeconds: overrides.editedSeconds ?? 0,
    })
    .returning();

  return { chapter: createdChapter };
}
