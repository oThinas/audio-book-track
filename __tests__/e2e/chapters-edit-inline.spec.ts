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

  test("rejects → completed without editor (server is source of truth)", async ({
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
      status: "reviewing",
      narratorId: narrator.id,
      editedSeconds: 3600,
    });

    await page.goto(`/books/${bookId}`);
    await page.getByTestId(`chapter-edit-${chapterId}`).click();

    // Completing requires an editor; the dropdown still offers it (FR-014),
    // and the server rejects on Save.
    await page.getByTestId(`chapter-status-${chapterId}`).click();
    await page.getByRole("option", { name: /^concluído$/i }).click();

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/chapters/${chapterId}`) && res.request().method() === "PATCH",
      ),
      page.getByTestId(`chapter-confirm-${chapterId}`).click(),
    ]);

    expect(response.status()).toBe(422);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("CHAPTER_EDITOR_REQUIRED");

    // Row stays in edit mode after server rejection
    await expect(page.getByTestId(`chapter-row-${chapterId}`)).toHaveAttribute("data-mode", "edit");
  });

  test("allows a free status change (pending → reviewing) in a single save", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Iracema",
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

    // pending → reviewing directly, with no narrator/editor/minutagem required.
    await page.getByTestId(`chapter-status-${chapterId}`).click();
    await page.getByRole("option", { name: /em revisão/i }).click();

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/chapters/${chapterId}`) && res.request().method() === "PATCH",
      ),
      page.getByTestId(`chapter-confirm-${chapterId}`).click(),
    ]);

    expect(response.status()).toBe(200);
    const body = (await response.json()) as { data: { status: string } };
    expect(body.data.status).toBe("reviewing");
    await expect(page.getByTestId(`chapter-row-${chapterId}`)).toHaveAttribute("data-mode", "view");
  });

  test("offers Pago only from completed (disabled on a non-completed chapter)", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Senhora",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: pendingId } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "pending",
    });
    const { id: completedId } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 2,
      status: "completed",
      editedSeconds: 3600,
    });

    await page.goto(`/books/${bookId}`);

    // On a pending chapter, Pago is disabled (paid only reachable from completed).
    await page.getByTestId(`chapter-edit-${pendingId}`).click();
    await page.getByTestId(`chapter-status-${pendingId}`).click();
    await expect(page.getByRole("option", { name: /^pago$/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await page.keyboard.press("Escape");
    await page.getByTestId(`chapter-cancel-${pendingId}`).click();

    // On a completed chapter, Pago is enabled.
    await page.getByTestId(`chapter-edit-${completedId}`).click();
    await page.getByTestId(`chapter-status-${completedId}`).click();
    await expect(page.getByRole("option", { name: /^pago$/i })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
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

  test("Enter from the title field saves the edit", async ({ page, appServer }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Teclado 1",
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

    const title = page.getByTestId(`chapter-title-${chapterId}`);
    await title.fill("Capítulo renomeado");

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/chapters/${chapterId}`) && res.request().method() === "PATCH",
      ),
      title.press("Enter"),
    ]);

    expect(response.status()).toBe(200);
    const body = (await response.json()) as { data: { title: string } };
    expect(body.data.title).toBe("Capítulo renomeado");
    await expect(page.getByTestId(`chapter-row-${chapterId}`)).toHaveAttribute("data-mode", "view");
  });

  test("Enter from a focused (closed) status trigger saves the edit", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Teclado 2",
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

    // Create a diff, then move focus to the closed status trigger and press Enter.
    await page.getByTestId(`chapter-title-${chapterId}`).fill("Salvo pelo Enter");
    await page.getByTestId(`chapter-status-${chapterId}`).focus();

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/chapters/${chapterId}`) && res.request().method() === "PATCH",
      ),
      page.keyboard.press("Enter"),
    ]);

    expect(response.status()).toBe(200);
    await expect(page.getByTestId(`chapter-row-${chapterId}`)).toHaveAttribute("data-mode", "view");
  });

  test("Enter while the status dropdown is open does not save; a second Enter does", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Teclado 3",
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

    // Diff so the eventual save produces a PATCH.
    await page.getByTestId(`chapter-title-${chapterId}`).fill("Após seleção");

    // Open the status dropdown; the first Enter acts on the open popup, not the row.
    await page.getByTestId(`chapter-status-${chapterId}`).click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Enter");

    // Dropdown closed, row still in edit mode, nothing saved yet.
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(page.getByTestId(`chapter-row-${chapterId}`)).toHaveAttribute("data-mode", "edit");

    // A second Enter (nothing open) saves.
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/chapters/${chapterId}`) && res.request().method() === "PATCH",
      ),
      page.keyboard.press("Enter"),
    ]);
    expect(response.status()).toBe(200);
    await expect(page.getByTestId(`chapter-row-${chapterId}`)).toHaveAttribute("data-mode", "view");
  });

  test("Escape with nothing open cancels the edit", async ({ page, appServer }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Teclado 4",
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

    const title = page.getByTestId(`chapter-title-${chapterId}`);
    await title.fill("Mudança descartada");
    await title.press("Escape");

    await expect(page.getByTestId(`chapter-row-${chapterId}`)).toHaveAttribute("data-mode", "view");
  });

  test("Escape closes an open dropdown first; a second Escape cancels", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Teclado 5",
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

    await page.getByTestId(`chapter-status-${chapterId}`).click();
    await expect(page.getByRole("listbox")).toBeVisible();

    // First Escape: Base UI closes the popup; the row stays in edit mode.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(page.getByTestId(`chapter-row-${chapterId}`)).toHaveAttribute("data-mode", "edit");

    // Second Escape: nothing open → the row cancels.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId(`chapter-row-${chapterId}`)).toHaveAttribute("data-mode", "view");
  });

  test("Enter on the Cancel button cancels (native button behavior)", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Teclado 6",
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

    await page.getByTestId(`chapter-title-${chapterId}`).fill("Não salvar");
    await page.getByTestId(`chapter-cancel-${chapterId}`).focus();
    await page.keyboard.press("Enter");

    await expect(page.getByTestId(`chapter-row-${chapterId}`)).toHaveAttribute("data-mode", "view");
  });

  test("Enter with an empty title shows a validation error and does not save (FR-005)", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Teclado 7",
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

    const title = page.getByTestId(`chapter-title-${chapterId}`);
    await title.fill("");
    await title.press("Enter");

    await expect(page.getByTestId(`chapter-title-error-${chapterId}`)).toBeVisible();
    await expect(page.getByTestId(`chapter-row-${chapterId}`)).toHaveAttribute("data-mode", "edit");
  });
});
