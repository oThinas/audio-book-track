// DEV-ONLY seed. Free to grow with example records for local exploration
// (sample studios, books, chapters). NOT used by tests — tests bootstrap
// through src/lib/db/seed-test.ts (admin only) and create their own data
// via factories. See CLAUDE.md › "Nova entidade: factory, não seed".
// (Heading kept in PT to match the section anchor in CLAUDE.md.)
import "dotenv/config";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { book, chapter, editor, narrator, studio } from "@/lib/db/schema";
import { computeBookStatus } from "@/lib/domain/book-status";
import type { ChapterStatus } from "@/lib/domain/chapter";
import { env } from "@/lib/env";

const seedAuth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
    }),
  ],
});

async function ensureAdmin(): Promise<void> {
  const existing = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.email, "admin@audiobook.local"),
    columns: { id: true },
  });
  if (existing) {
    console.info("Admin user already exists, skipping auth seed.");
    return;
  }

  const result = await seedAuth.api.signUpEmail({
    body: {
      name: "Administrador",
      email: "admin@audiobook.local",
      password: "admin123",
      username: "admin",
    },
  });

  if (!result) {
    throw new Error("Failed to create admin user.");
  }
  console.info("Admin user created: username=admin, email=admin@audiobook.local");
}

// --- Deterministic helpers ------------------------------------------------

// Linear congruential generator seeded with a fixed value so the dataset is
// stable across runs (e.g. for screenshot review or doc walkthroughs).
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

const rng = makeRng(0x428dada);

function pickInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pickOne<T>(items: ReadonlyArray<T>): T {
  return items[Math.floor(rng() * items.length)] as T;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

// --- Reference data -------------------------------------------------------

const STUDIOS: ReadonlyArray<{ name: string; rate: number }> = [
  { name: "Estúdio Aurora", rate: 8000 },
  { name: "Studio Voz Viva", rate: 9500 },
  { name: "Casa do Som", rate: 7000 },
  { name: "Litera Áudio", rate: 11000 },
  { name: "Onda Sonora", rate: 6500 },
];

const NARRATORS: ReadonlyArray<string> = [
  "Marina Pessoa",
  "Rafael Andrade",
  "Beatriz Sales",
  "Tiago Lemos",
  "Júlia Bernardes",
  "Otávio Cardoso",
  "Helena Drummond",
  "Caio Ramalho",
];

const EDITORS: ReadonlyArray<{ name: string; email: string }> = [
  { name: "Paula Quintana", email: "paula.quintana@editora.dev" },
  { name: "André Veiga", email: "andre.veiga@editora.dev" },
  { name: "Luiza Bastos", email: "luiza.bastos@editora.dev" },
  { name: "Marcelo Tinoco", email: "marcelo.tinoco@editora.dev" },
  { name: "Renata Bicalho", email: "renata.bicalho@editora.dev" },
];

interface BookSpec {
  readonly title: string;
  readonly studioIndex: number;
  readonly pricePerHourCents: number;
  readonly chapterCount: number;
  /** Mistura de status para os capítulos deste livro. Soma deve bater com chapterCount. */
  readonly mix: Partial<Record<ChapterStatus, number>>;
  /** Janela (em dias atrás) de paid_at para capítulos pagos. */
  readonly paidWindowDays?: { readonly minDaysAgo: number; readonly maxDaysAgo: number };
  /** Se true, cria 1–2 capítulos atrasados (deadline no passado, status ativo). */
  readonly seedOverdue?: boolean;
}

const BOOKS: ReadonlyArray<BookSpec> = [
  {
    title: "O Cortiço",
    studioIndex: 0,
    pricePerHourCents: 8500,
    chapterCount: 12,
    mix: { paid: 8, completed: 2, reviewing: 1, editing: 1 },
    paidWindowDays: { minDaysAgo: 0, maxDaysAgo: 90 },
  },
  {
    title: "Memórias Póstumas de Brás Cubas",
    studioIndex: 0,
    pricePerHourCents: 9000,
    chapterCount: 10,
    mix: { paid: 6, completed: 3, retake: 1 },
    paidWindowDays: { minDaysAgo: 30, maxDaysAgo: 180 },
    seedOverdue: true,
  },
  {
    title: "Dom Casmurro",
    studioIndex: 1,
    pricePerHourCents: 9500,
    chapterCount: 14,
    mix: { paid: 14 },
    paidWindowDays: { minDaysAgo: 5, maxDaysAgo: 60 },
  },
  {
    title: "A Hora da Estrela",
    studioIndex: 1,
    pricePerHourCents: 11000,
    chapterCount: 6,
    mix: { paid: 2, completed: 3, reviewing: 1 },
    paidWindowDays: { minDaysAgo: 7, maxDaysAgo: 40 },
  },
  {
    title: "Vidas Secas",
    studioIndex: 2,
    pricePerHourCents: 7200,
    chapterCount: 8,
    mix: { paid: 4, completed: 2, editing: 1, pending: 1 },
    paidWindowDays: { minDaysAgo: 60, maxDaysAgo: 240 },
  },
  {
    title: "Capitães da Areia",
    studioIndex: 2,
    pricePerHourCents: 7500,
    chapterCount: 10,
    mix: { paid: 3, completed: 4, reviewing: 2, retake: 1 },
    paidWindowDays: { minDaysAgo: 90, maxDaysAgo: 300 },
    seedOverdue: true,
  },
  {
    title: "Grande Sertão: Veredas",
    studioIndex: 3,
    pricePerHourCents: 12000,
    chapterCount: 16,
    mix: { paid: 4, completed: 5, reviewing: 3, editing: 2, pending: 2 },
    paidWindowDays: { minDaysAgo: 1, maxDaysAgo: 30 },
  },
  {
    title: "Macunaíma",
    studioIndex: 3,
    pricePerHourCents: 11500,
    chapterCount: 9,
    mix: { paid: 9 },
    paidWindowDays: { minDaysAgo: 120, maxDaysAgo: 365 },
  },
  {
    title: "Iracema",
    studioIndex: 4,
    pricePerHourCents: 6800,
    chapterCount: 7,
    mix: { paid: 5, completed: 1, editing: 1 },
    paidWindowDays: { minDaysAgo: 14, maxDaysAgo: 75 },
  },
  {
    title: "O Guarani",
    studioIndex: 4,
    pricePerHourCents: 7000,
    chapterCount: 12,
    mix: { completed: 5, reviewing: 3, editing: 2, retake: 1, pending: 1 },
    seedOverdue: true,
  },
];

// --- Seed builder ---------------------------------------------------------

interface SeededRefs {
  readonly studioIds: ReadonlyArray<string>;
  readonly narratorIds: ReadonlyArray<string>;
  readonly editorIds: ReadonlyArray<string>;
}

async function seedReferenceData(): Promise<SeededRefs> {
  const studioRows = await db
    .insert(studio)
    .values(STUDIOS.map((s) => ({ name: s.name, defaultHourlyRateCents: s.rate })))
    .returning({ id: studio.id });

  const narratorRows = await db
    .insert(narrator)
    .values(NARRATORS.map((name) => ({ name })))
    .returning({ id: narrator.id });

  const editorRows = await db
    .insert(editor)
    .values(EDITORS.map((e) => ({ name: e.name, email: e.email })))
    .returning({ id: editor.id });

  return {
    studioIds: studioRows.map((r) => r.id),
    narratorIds: narratorRows.map((r) => r.id),
    editorIds: editorRows.map((r) => r.id),
  };
}

function expandMix(spec: BookSpec): ChapterStatus[] {
  const expanded: ChapterStatus[] = [];
  for (const [status, count] of Object.entries(spec.mix) as Array<[ChapterStatus, number]>) {
    for (let i = 0; i < count; i += 1) expanded.push(status);
  }
  const remaining = spec.chapterCount - expanded.length;
  for (let i = 0; i < remaining; i += 1) expanded.push("pending");
  return expanded.slice(0, spec.chapterCount);
}

async function seedBooks(refs: SeededRefs, today: Date): Promise<void> {
  for (const spec of BOOKS) {
    const studioId = refs.studioIds[spec.studioIndex] as string;
    const [createdBook] = await db
      .insert(book)
      .values({
        title: spec.title,
        studioId,
        pricePerHourCents: spec.pricePerHourCents,
      })
      .returning({ id: book.id });
    if (!createdBook) continue;

    const statusList = expandMix(spec);
    const chapterRows = statusList.map((status, position) => {
      const needsNarrator = status !== "pending";
      const needsEditor = status === "reviewing" || status === "completed" || status === "paid";
      const editedSeconds =
        status === "pending" ? 0 : status === "editing" ? pickInt(60, 900) : pickInt(1800, 5400); // 30–90 min for chapters past editing

      // paid_at / completed_at distribution.
      const completedAt =
        status === "completed" || status === "paid" || status === "reviewing"
          ? backDate(today, status === "reviewing" ? pickInt(1, 15) : pickInt(2, 365))
          : null;
      const paidAt =
        status === "paid"
          ? backDate(today, pickWindow(spec.paidWindowDays ?? { minDaysAgo: 5, maxDaysAgo: 180 }))
          : null;

      const deadline = computeDeadline(spec, status, position, today);

      return {
        bookId: createdBook.id,
        title: chapterTitle(position),
        position,
        status,
        narratorId: needsNarrator ? pickOne(refs.narratorIds) : null,
        editorId: needsEditor ? pickOne(refs.editorIds) : null,
        editedSeconds,
        deadline,
        completedAt,
        paidAt,
      };
    });

    await db.insert(chapter).values(chapterRows);

    const bookStatus = computeBookStatus(statusList.map((status) => ({ status })));
    await db
      .update(book)
      .set({ status: bookStatus, chaptersVersion: 0 })
      .where(eq(book.id, createdBook.id));
  }
}

function chapterTitle(position: number): string {
  if (position === 0) return "Prólogo";
  return `Capítulo ${position}`;
}

function backDate(today: Date, daysAgo: number): Date {
  return addDays(today, -Math.max(0, daysAgo));
}

function pickWindow(window: { minDaysAgo: number; maxDaysAgo: number }): number {
  return pickInt(window.minDaysAgo, window.maxDaysAgo);
}

function computeDeadline(
  spec: BookSpec,
  status: ChapterStatus,
  position: number,
  today: Date,
): string | null {
  // Overdue chapters: first active chapter gets a deadline in the past.
  if (
    spec.seedOverdue &&
    position === 0 &&
    (status === "pending" || status === "editing" || status === "reviewing" || status === "retake")
  ) {
    return isoDate(backDate(today, pickInt(5, 25)));
  }
  // Active chapters frequently have an upcoming deadline; paid/completed have null.
  if (status === "pending" || status === "editing" || status === "reviewing") {
    return isoDate(addDays(today, pickInt(2, 30)));
  }
  return null;
}

async function hasDomainData(): Promise<boolean> {
  const rows = await db.select({ id: studio.id }).from(studio).limit(1);
  return rows.length > 0;
}

async function truncateDomain(): Promise<void> {
  // chapter → book → studio (FKs use RESTRICT, so cascade by hand).
  await db.delete(chapter);
  await db.delete(book);
  await db.delete(studio);
  await db.delete(narrator);
  await db.delete(editor);
}

// --- Entry point ----------------------------------------------------------

async function main(): Promise<void> {
  const force = process.argv.includes("--force") || process.argv.includes("--reseed");
  console.info("Seeding database...", force ? "(force mode)" : "");
  await ensureAdmin();

  if (await hasDomainData()) {
    if (!force) {
      console.info(
        "Domain data already present, skipping demo seed. Pass --force to truncate and reseed.",
      );
      process.exit(0);
    }
    console.info("--force: truncating studios/narrators/editors/books/chapters …");
    await truncateDomain();
  }

  // Anchor "today" to the current calendar date so paid_at falls within a
  // meaningful retrospective window when running the dashboard locally.
  const today = new Date();
  const refs = await seedReferenceData();
  await seedBooks(refs, today);

  console.info("Demo data seeded:", {
    studios: STUDIOS.length,
    narrators: NARRATORS.length,
    editors: EDITORS.length,
    books: BOOKS.length,
    chapters: BOOKS.reduce((acc, b) => acc + b.chapterCount, 0),
  });

  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
