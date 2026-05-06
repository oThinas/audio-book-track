import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { closeSeedPool, seedBook, seedChapter, seedStudio } from "./helpers/seed";

test.afterAll(async () => {
  await closeSeedPool();
});

test.describe("Studio delete — STUDIO_HAS_ACTIVE_BOOKS precondition", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("blocks delete with a 409 toast when the studio has a book with an active chapter", async ({
    page,
    appServer,
  }) => {
    const studioName = `Studio Bloqueio ${Math.random().toString(36).slice(2, 8)}`;
    const studio = await seedStudio(page, studioName, 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Livro Em Edição",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "editing",
    });

    await page.goto("/studios");
    const row = page.getByTestId("studio-row").filter({ hasText: studioName });
    await row.getByRole("button", { name: new RegExp(`excluir ${studioName}`, "i") }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/studios/${studio.id}`) && res.request().method() === "DELETE",
      ),
      dialog.getByRole("button", { name: /^excluir$/i }).click(),
    ]);
    expect(response.status()).toBe(409);

    // toast appears with the blocking message
    await expect(page.getByText(/livro\(s\) com cap[íi]tulos ativos/i)).toBeVisible();
    await expect(page.getByText(/livro em edi[çc]ão/i)).toBeVisible();

    // Studio was NOT removed — still appears in the listing
    await expect(page.getByTestId("studio-row").filter({ hasText: studioName })).toBeVisible();
  });

  test("allows soft-delete when all chapters are completed/paid; studio disappears from /studios", async ({
    page,
    appServer,
  }) => {
    const studioName = `Studio OK ${Math.random().toString(36).slice(2, 8)}`;
    const studio = await seedStudio(page, studioName, 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Livro Concluído",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await seedChapter({
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
      status: "paid",
      editedSeconds: 3600,
    });

    await page.goto("/studios");
    const row = page.getByTestId("studio-row").filter({ hasText: studioName });
    await row.getByRole("button", { name: new RegExp(`excluir ${studioName}`, "i") }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/studios/${studio.id}`) && res.request().method() === "DELETE",
      ),
      dialog.getByRole("button", { name: /^excluir$/i }).click(),
    ]);
    expect(response.status()).toBe(204);

    // Studio disappeared from the listing (soft-deleted).
    await expect(page.getByTestId("studio-row").filter({ hasText: studioName })).toHaveCount(0);
  });

  test("re-creating a studio with the same name reactivates the soft-deleted record (FR-046a)", async ({
    page,
  }) => {
    const studioName = `Reativar ${Math.random().toString(36).slice(2, 8)}`;

    // Create, soft-delete (with no blocking books), then recreate with the same name.
    await seedStudio(page, studioName, 50);

    // Soft-delete via UI
    await page.goto("/studios");
    const row = page.getByTestId("studio-row").filter({ hasText: studioName });
    await row.getByRole("button", { name: new RegExp(`excluir ${studioName}`, "i") }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: /^excluir$/i }).click();
    await expect(page.getByTestId("studio-row").filter({ hasText: studioName })).toHaveCount(0);

    // Recreate with the same name and a different rate — should reactivate (not create a duplicate).
    const response = await page.request.post("/api/v1/studios", {
      data: { name: studioName, defaultHourlyRateCents: 9000 },
    });
    expect(response.status()).toBe(200); // 200 = reactivated (not 201)
    const body = (await response.json()) as { meta: { reactivated: boolean } };
    expect(body.meta.reactivated).toBe(true);

    // Reload /studios — the studio is back.
    await page.goto("/studios");
    await expect(page.getByTestId("studio-row").filter({ hasText: studioName })).toBeVisible();
  });
});
