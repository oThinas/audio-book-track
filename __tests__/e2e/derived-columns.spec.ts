import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { closeSeedPool, getSeedPool, seedBook, seedChapter, seedStudio } from "./helpers/seed";

test.afterAll(async () => {
  await closeSeedPool();
});

async function seedNarrator(schema: string, name: string): Promise<{ id: string }> {
  const pool = getSeedPool();
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO "${schema}"."narrator" (id, name, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, now(), now())
     RETURNING id`,
    [name],
  );
  return { id: rows[0].id };
}

async function seedEditor(schema: string, name: string, email: string): Promise<{ id: string }> {
  const pool = getSeedPool();
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO "${schema}"."editor" (id, name, email, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, now(), now())
     RETURNING id`,
    [name, email],
  );
  return { id: rows[0].id };
}

async function attachNarrator(schema: string, chapterId: string, narratorId: string) {
  const pool = getSeedPool();
  await pool.query(`UPDATE "${schema}"."chapter" SET narrator_id = $1 WHERE id = $2`, [
    narratorId,
    chapterId,
  ]);
}

async function attachEditor(schema: string, chapterId: string, editorId: string) {
  const pool = getSeedPool();
  await pool.query(`UPDATE "${schema}"."chapter" SET editor_id = $1 WHERE id = $2`, [
    editorId,
    chapterId,
  ]);
}

test.describe("Derived columns (US12)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("studios list shows Livros column with the correct count and is sortable", async ({
    page,
    appServer,
  }) => {
    const studioWith3 = await seedStudio(page, "Studio Tres", 75);
    const studioWith1 = await seedStudio(page, "Studio Um", 80);
    await seedStudio(page, "Studio Zero", 90);
    for (const title of ["L1", "L2", "L3"]) {
      await seedBook({
        schema: appServer.schemaName,
        title,
        studioId: studioWith3.id,
        pricePerHourCents: 7500,
      });
    }
    await seedBook({
      schema: appServer.schemaName,
      title: "Lone",
      studioId: studioWith1.id,
      pricePerHourCents: 8000,
    });

    await page.goto("/studios");

    const tresRow = page.getByTestId("studio-row").filter({ hasText: "Studio Tres" });
    const umRow = page.getByTestId("studio-row").filter({ hasText: "Studio Um" });
    const zeroRow = page.getByTestId("studio-row").filter({ hasText: "Studio Zero" });

    await expect(tresRow.getByTestId("studio-books-count")).toHaveText("3");
    await expect(umRow.getByTestId("studio-books-count")).toHaveText("1");
    await expect(zeroRow.getByTestId("studio-books-count")).toHaveText("0");

    // Ordena pela coluna Livros (asc → desc).
    const livrosHeader = page.getByRole("button", { name: /^livros/i });
    await livrosHeader.click();
    let counts = await page.getByTestId("studio-books-count").allInnerTexts();
    expect(counts.map(Number).slice(0, 3)).toEqual([0, 1, 3]);

    await livrosHeader.click();
    counts = await page.getByTestId("studio-books-count").allInnerTexts();
    expect(counts.map(Number).slice(0, 3)).toEqual([3, 1, 0]);
  });

  test("narrators list shows Capítulos column with the correct count", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(
      page,
      `Studio Narr ${Math.random().toString(36).slice(2, 8)}`,
      75,
    );
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: `Livro Narr ${Math.random().toString(36).slice(2, 8)}`,
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const chapters = await Promise.all(
      [1, 2, 3, 4, 5].map((number) =>
        seedChapter({
          schema: appServer.schemaName,
          bookId,
          number,
          status: "pending",
        }),
      ),
    );

    const narratorName = `Narr Cinco ${Math.random().toString(36).slice(2, 8)}`;
    const { id: narratorId } = await seedNarrator(appServer.schemaName, narratorName);
    for (const c of chapters) await attachNarrator(appServer.schemaName, c.id, narratorId);

    await page.goto("/narrators");

    const row = page.getByTestId("narrator-row").filter({ hasText: narratorName });
    await expect(row.getByTestId("narrator-chapters-count")).toHaveText("5");
  });

  test("editors list shows Capítulos column with the correct count", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(
      page,
      `Studio Ed ${Math.random().toString(36).slice(2, 8)}`,
      75,
    );
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: `Livro Ed ${Math.random().toString(36).slice(2, 8)}`,
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const chapters = await Promise.all(
      [1, 2, 3].map((number) =>
        seedChapter({
          schema: appServer.schemaName,
          bookId,
          number,
          status: "pending",
        }),
      ),
    );

    const editorName = `Editor Tres ${Math.random().toString(36).slice(2, 8)}`;
    const editorEmail = `${editorName.toLowerCase().replace(/\s+/g, "-")}@e2e.local`;
    const { id: editorId } = await seedEditor(appServer.schemaName, editorName, editorEmail);
    for (const c of chapters) await attachEditor(appServer.schemaName, c.id, editorId);

    await page.goto("/editors");

    const row = page.getByTestId("editor-row").filter({ hasText: editorName });
    await expect(row.getByTestId("editor-chapters-count")).toHaveText("3");
  });
});
