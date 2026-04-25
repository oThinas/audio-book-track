import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { closeSeedPool, seedBook, seedChapter, seedStudio } from "./helpers/seed";

test.afterAll(async () => {
  await closeSeedPool();
});

async function seedNarrator(page: Page, name: string): Promise<{ id: string }> {
  const response = await page.request.post("/api/v1/narrators", { data: { name } });
  if (!response.ok()) throw new Error(`seedNarrator failed: ${response.status()}`);
  const body = (await response.json()) as { data: { id: string } };
  return { id: body.data.id };
}

async function seedEditor(page: Page, name: string, email: string): Promise<{ id: string }> {
  const response = await page.request.post("/api/v1/editors", { data: { name, email } });
  if (!response.ok()) throw new Error(`seedEditor failed: ${response.status()}`);
  const body = (await response.json()) as { data: { id: string } };
  return { id: body.data.id };
}

test.describe("Chapter inline edit", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("transitions pending → editing with narrator and updates book status badge", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const narrator = await seedNarrator(page, "Ana Silva");
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Dom Casmurro",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: chapterId } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "pending",
    });

    await page.goto(`/books/${bookId}`);

    await page.getByTestId(`chapter-edit-${chapterId}`).click();

    // Choose narrator
    await page.getByTestId(`chapter-narrator-${chapterId}`).click();
    await page.getByRole("option", { name: /ana silva/i }).click();

    // Status: pending → editing
    await page.getByTestId(`chapter-status-${chapterId}`).click();
    await page.getByRole("option", { name: /em edição/i }).click();

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/chapters/${chapterId}`) && res.request().method() === "PATCH",
      ),
      page.getByTestId(`chapter-confirm-${chapterId}`).click(),
    ]);

    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data: { status: string; narratorId: string };
      meta: { bookStatus: string };
    };
    expect(body.data.status).toBe("editing");
    expect(body.data.narratorId).toBe(narrator.id);
    expect(body.meta.bookStatus).toBe("editing");

    // Row falls back to view mode and book header reflects the new status
    await expect(page.getByTestId(`chapter-row-${chapterId}`)).toHaveAttribute("data-mode", "view");
  });

  test("rejects editing → reviewing without editor (server validation)", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const narrator = await seedNarrator(page, "Ana Silva 2");
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Memorial",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: chapterId } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "editing",
      narratorId: narrator.id,
    });

    await page.goto(`/books/${bookId}`);
    await page.getByTestId(`chapter-edit-${chapterId}`).click();

    await page.getByTestId(`chapter-status-${chapterId}`).click();
    await page.getByRole("option", { name: /em revisão/i }).click();

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/chapters/${chapterId}`) && res.request().method() === "PATCH",
      ),
      page.getByTestId(`chapter-confirm-${chapterId}`).click(),
    ]);

    expect(response.status()).toBe(422);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("EDITOR_OR_SECONDS_REQUIRED");

    // Row stays in edit mode after server rejection
    await expect(page.getByTestId(`chapter-row-${chapterId}`)).toHaveAttribute("data-mode", "edit");
  });

  test("paid → completed requires confirmation dialog", async ({ page, appServer }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const editor = await seedEditor(page, `Bruno ${Date.now()}`, `bruno-${Date.now()}@x.com`);
    void editor;
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Reversão",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: chapterId } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "paid",
      editedSeconds: 3600,
    });

    await page.goto(`/books/${bookId}`);
    await page.getByTestId(`chapter-edit-${chapterId}`).click();

    await page.getByTestId(`chapter-status-${chapterId}`).click();
    await page.getByRole("option", { name: /^concluído$/i }).click();

    await page.getByTestId(`chapter-confirm-${chapterId}`).click();

    await expect(page.getByTestId("chapter-paid-reversion-dialog")).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/chapters/${chapterId}`) && res.request().method() === "PATCH",
      ),
      page.getByTestId("chapter-paid-reversion-confirm").click(),
    ]);

    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data: { status: string };
      meta: { bookStatus: string };
    };
    expect(body.data.status).toBe("completed");
    expect(body.meta.bookStatus).toBe("completed");
  });
});
