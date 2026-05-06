import { expect, test } from "./fixtures/app-server";
import { closeSeedPool, getSeedPool } from "./helpers/seed";

const STUDIOS = 50;
const BOOKS_PER_STUDIO = 10;
const RUNS = 5;
// The overhead introduced by LEFT JOIN + COUNT on /api/v1/studios
// must not exceed 100ms versus the same listing without aggregation.
const MAX_OVERHEAD_MS = 100;

test.afterAll(async () => {
  await closeSeedPool();
});

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

test.describe("Derived columns — SC-011 perf overhead", () => {
  test(`COUNT overhead < ${MAX_OVERHEAD_MS}ms (50 studios × 10 books)`, async ({ appServer }) => {
    const schema = appServer.schemaName;
    const pool = getSeedPool();

    // Seed 50 studios and 10 books per studio in two bulk inserts,
    // avoiding 500 individual round-trips.
    await pool.query(
      `INSERT INTO "${schema}"."studio" (id, name, default_hourly_rate_cents, created_at, updated_at)
       SELECT gen_random_uuid(), 'Perf Studio ' || lpad(i::text, 3, '0'), 7500, now(), now()
       FROM generate_series(1, $1) AS i`,
      [STUDIOS],
    );
    await pool.query(
      `INSERT INTO "${schema}"."book"
         (id, title, studio_id, price_per_hour_cents, status, created_at, updated_at)
       SELECT
         gen_random_uuid(),
         'Perf Book ' || s.name || '-' || j,
         s.id,
         7500,
         'pending',
         now(),
         now()
       FROM "${schema}"."studio" s
       CROSS JOIN generate_series(1, $1) AS j
       WHERE s.name LIKE 'Perf Studio %'`,
      [BOOKS_PER_STUDIO],
    );

    // Warm up the PostgreSQL cache before measurements to reduce variance.
    await pool.query(`SELECT id, name FROM "${schema}"."studio" WHERE deleted_at IS NULL`);
    await pool.query(
      `SELECT s.id, s.name, COUNT(b.id)::int AS books_count
       FROM "${schema}"."studio" s
       LEFT JOIN "${schema}"."book" b ON b.studio_id = s.id
       WHERE s.deleted_at IS NULL
       GROUP BY s.id`,
    );

    const baselineSamples: number[] = [];
    const joinSamples: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const t1 = performance.now();
      await pool.query(
        `SELECT id, name FROM "${schema}"."studio" WHERE deleted_at IS NULL ORDER BY created_at`,
      );
      baselineSamples.push(performance.now() - t1);

      const t2 = performance.now();
      await pool.query(
        `SELECT s.id, s.name, COALESCE(COUNT(b.id), 0)::int AS books_count
         FROM "${schema}"."studio" s
         LEFT JOIN "${schema}"."book" b ON b.studio_id = s.id
         WHERE s.deleted_at IS NULL
         GROUP BY s.id
         ORDER BY s.created_at`,
      );
      joinSamples.push(performance.now() - t2);
    }

    const baselineMs = median(baselineSamples);
    const joinMs = median(joinSamples);
    const overheadMs = joinMs - baselineMs;

    // Print the actual numbers so they can be recorded in quickstart.md §5.
    console.info(
      `baseline=${baselineMs.toFixed(2)}ms join=${joinMs.toFixed(2)}ms overhead=${overheadMs.toFixed(2)}ms`,
    );
    expect(overheadMs).toBeLessThan(MAX_OVERHEAD_MS);
  });
});
