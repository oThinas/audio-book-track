import type { Page } from "@playwright/test";
import { Pool } from "pg";

let seedPool: Pool | undefined;

export function getSeedPool(): Pool {
  if (!seedPool) {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) throw new Error("TEST_DATABASE_URL is required for E2E seeding.");
    seedPool = new Pool({ connectionString: url, max: 2 });
  }
  return seedPool;
}

export async function closeSeedPool(): Promise<void> {
  if (seedPool) {
    await seedPool.end();
    seedPool = undefined;
  }
}

export async function seedStudio(
  page: Page,
  name: string,
  defaultHourlyRateReais: number,
): Promise<{ id: string }> {
  const response = await page.request.post("/api/v1/studios", {
    data: { name, defaultHourlyRateCents: Math.round(defaultHourlyRateReais * 100) },
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed studio ${name}: ${response.status()}`);
  }
  const body = (await response.json()) as { data: { id: string } };
  return { id: body.data.id };
}

export interface SeedBookOptions {
  readonly schema: string;
  readonly title: string;
  readonly studioId: string;
  readonly pricePerHourCents: number;
  readonly createdAt?: Date;
}

export async function seedBook(options: SeedBookOptions): Promise<{ id: string }> {
  const pool = getSeedPool();
  const createdAt = options.createdAt ?? new Date();
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO "${options.schema}"."book"
       (id, title, studio_id, price_per_hour_cents, status, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, 'pending', $4, $4)
     RETURNING id`,
    [options.title, options.studioId, options.pricePerHourCents, createdAt],
  );
  return { id: rows[0].id };
}

export type SeedChapterStatus =
  | "pending"
  | "editing"
  | "reviewing"
  | "retake"
  | "completed"
  | "paid";

export interface SeedChapterOptions {
  readonly schema: string;
  readonly bookId: string;
  readonly number: number;
  readonly status?: SeedChapterStatus;
  readonly editedSeconds?: number;
  readonly narratorId?: string | null;
  readonly editorId?: string | null;
}

export async function seedChapter(options: SeedChapterOptions): Promise<{ id: string }> {
  const pool = getSeedPool();
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO "${options.schema}"."chapter"
       (id, book_id, number, status, narrator_id, editor_id, edited_seconds, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now(), now())
     RETURNING id`,
    [
      options.bookId,
      options.number,
      options.status ?? "pending",
      options.narratorId ?? null,
      options.editorId ?? null,
      options.editedSeconds ?? 0,
    ],
  );
  return { id: rows[0].id };
}
