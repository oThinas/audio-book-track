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

async function attachNarratorToChapter(
  schema: string,
  chapterId: string,
  narratorId: string,
): Promise<void> {
  const pool = getSeedPool();
  await pool.query(`UPDATE "${schema}"."chapter" SET narrator_id = $1 WHERE id = $2`, [
    narratorId,
    chapterId,
  ]);
}

async function attachEditorToChapter(
  schema: string,
  chapterId: string,
  editorId: string,
): Promise<void> {
  const pool = getSeedPool();
  await pool.query(`UPDATE "${schema}"."chapter" SET editor_id = $1 WHERE id = $2`, [
    editorId,
    chapterId,
  ]);
}

test.describe("Narrator/Editor delete — LINKED_TO_ACTIVE_CHAPTERS precondition (US11)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("blocks narrator delete with toast when narrator has chapter in a book with active chapters", async ({
    page,
    appServer,
  }) => {
    const narratorName = `Narrador Bloqueio ${Math.random().toString(36).slice(2, 8)}`;
    const studio = await seedStudio(page, `Studio ${narratorName}`, 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: `Livro Em Edição ${narratorName}`,
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: pendingChapter } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "pending",
    });
    const { id: paidChapter } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 2,
      status: "paid",
      editedSeconds: 3600,
    });

    const { id: narratorId } = await seedNarrator(appServer.schemaName, narratorName);
    await attachNarratorToChapter(appServer.schemaName, paidChapter, narratorId);
    // pendingChapter sem narrador — mas mantém o livro como "ativo"
    void pendingChapter;

    await page.goto("/narrators");
    const row = page.getByTestId("narrator-row").filter({ hasText: narratorName });
    await row.getByRole("button", { name: new RegExp(`excluir ${narratorName}`, "i") }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/narrators/${narratorId}`) &&
          res.request().method() === "DELETE",
      ),
      dialog.getByRole("button", { name: /^excluir$/i }).click(),
    ]);
    expect(response.status()).toBe(409);

    await expect(page.getByText(/cap[íi]tulos em \d+ livro\(s\) ativo\(s\)/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Livro Em Edição ${narratorName}`, "i"))).toBeVisible();

    // narrador NÃO foi removido
    await expect(page.getByTestId("narrator-row").filter({ hasText: narratorName })).toBeVisible();
  });

  test("allows narrator soft-delete when all linked books are completed/paid", async ({
    page,
    appServer,
  }) => {
    const narratorName = `Narrador OK ${Math.random().toString(36).slice(2, 8)}`;
    const studio = await seedStudio(page, `Studio ${narratorName}`, 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: `Livro Concluído ${narratorName}`,
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: paidChapter } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "paid",
      editedSeconds: 3600,
    });

    const { id: narratorId } = await seedNarrator(appServer.schemaName, narratorName);
    await attachNarratorToChapter(appServer.schemaName, paidChapter, narratorId);

    await page.goto("/narrators");
    const row = page.getByTestId("narrator-row").filter({ hasText: narratorName });
    await row.getByRole("button", { name: new RegExp(`excluir ${narratorName}`, "i") }).click();

    const dialog = page.getByRole("alertdialog");
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/narrators/${narratorId}`) &&
          res.request().method() === "DELETE",
      ),
      dialog.getByRole("button", { name: /^excluir$/i }).click(),
    ]);
    expect(response.status()).toBe(204);

    await expect(page.getByTestId("narrator-row").filter({ hasText: narratorName })).toHaveCount(0);
  });

  test("blocks editor delete with toast when editor has chapter in a book with active chapters", async ({
    page,
    appServer,
  }) => {
    const editorName = `Editor Bloqueio ${Math.random().toString(36).slice(2, 8)}`;
    const editorEmail = `${editorName.toLowerCase().replace(/\s+/g, "-")}@e2e.local`;
    const studio = await seedStudio(page, `Studio ${editorName}`, 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: `Livro Em Revisão ${editorName}`,
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: completedChapter } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "completed",
      editedSeconds: 3600,
    });
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 2,
      status: "reviewing",
    });

    const { id: editorId } = await seedEditor(appServer.schemaName, editorName, editorEmail);
    await attachEditorToChapter(appServer.schemaName, completedChapter, editorId);

    await page.goto("/editors");
    const row = page.getByTestId("editor-row").filter({ hasText: editorName });
    await row.getByRole("button", { name: new RegExp(`excluir ${editorName}`, "i") }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/editors/${editorId}`) && res.request().method() === "DELETE",
      ),
      dialog.getByRole("button", { name: /^excluir$/i }).click(),
    ]);
    expect(response.status()).toBe(409);

    await expect(page.getByText(/cap[íi]tulos em \d+ livro\(s\) ativo\(s\)/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Livro Em Revisão ${editorName}`, "i"))).toBeVisible();

    await expect(page.getByTestId("editor-row").filter({ hasText: editorName })).toBeVisible();
  });

  test("allows editor soft-delete when all linked books are completed/paid", async ({
    page,
    appServer,
  }) => {
    const editorName = `Editor OK ${Math.random().toString(36).slice(2, 8)}`;
    const editorEmail = `${editorName.toLowerCase().replace(/\s+/g, "-")}@e2e.local`;
    const studio = await seedStudio(page, `Studio ${editorName}`, 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: `Livro Concluído ${editorName}`,
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: paidChapter } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "paid",
      editedSeconds: 3600,
    });

    const { id: editorId } = await seedEditor(appServer.schemaName, editorName, editorEmail);
    await attachEditorToChapter(appServer.schemaName, paidChapter, editorId);

    await page.goto("/editors");
    const row = page.getByTestId("editor-row").filter({ hasText: editorName });
    await row.getByRole("button", { name: new RegExp(`excluir ${editorName}`, "i") }).click();

    const dialog = page.getByRole("alertdialog");
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/editors/${editorId}`) && res.request().method() === "DELETE",
      ),
      dialog.getByRole("button", { name: /^excluir$/i }).click(),
    ]);
    expect(response.status()).toBe(204);

    await expect(page.getByTestId("editor-row").filter({ hasText: editorName })).toHaveCount(0);
  });
});
