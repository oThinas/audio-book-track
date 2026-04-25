import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { closeSeedPool, seedBook, seedChapter, seedStudio } from "./helpers/seed";

test.afterAll(async () => {
  await closeSeedPool();
});

test.describe("Chapters bulk-delete mode", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("activates selection mode, hides action icons, deletes selected chapters", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Bulk Studio", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Quatro capítulos",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: c1 } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "pending",
    });
    const { id: c2 } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 2,
      status: "editing",
    });
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 3,
      status: "completed",
      editedSeconds: 3600,
    });
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 4,
      status: "completed",
      editedSeconds: 3600,
    });

    await page.goto(`/books/${bookId}`);

    // Enter selection mode.
    await page.getByTestId("book-detail-enter-selection-mode").click();
    await expect(page.getByTestId("chapters-bulk-delete-bar")).toBeVisible();

    // Action icons (edit/delete) are hidden while in selection mode.
    await expect(page.getByTestId(`chapter-edit-${c1}`)).toHaveCount(0);
    await expect(page.getByTestId(`chapter-delete-${c1}`)).toHaveCount(0);

    // Select two chapters.
    await page.getByTestId(`chapter-select-${c1}`).click();
    await page.getByTestId(`chapter-select-${c2}`).click();
    await expect(page.getByTestId("chapters-bulk-delete-count")).toHaveText(
      "2 capítulos selecionados",
    );

    // Confirm via the sticky bar then the AlertDialog.
    await page.getByTestId("chapters-bulk-delete-confirm-trigger").click();
    const dialog = page.getByTestId("chapters-bulk-delete-confirm");
    await expect(dialog).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/books/${bookId}/chapters/bulk-delete`) &&
          res.request().method() === "POST",
      ),
      dialog.getByTestId("chapters-bulk-delete-confirm-action").click(),
    ]);
    expect(response.status()).toBe(204);
    expect(response.headers()["x-book-deleted"]).toBeUndefined();

    // Selection mode is exited; remaining chapters visible.
    await expect(page.getByTestId("chapters-bulk-delete-bar")).toHaveCount(0);
    await expect(page.getByTestId(`chapter-row-${c1}`)).toHaveCount(0);
    await expect(page.getByTestId(`chapter-row-${c2}`)).toHaveCount(0);
    await expect(page.getByTestId("chapters-scroll-area").getByRole("row")).toHaveCount(3); // header + 2
  });

  test("paid chapters render disabled checkboxes and select-all skips them", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Bulk Paid Studio", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Mistura com pago",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: pending } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "pending",
    });
    const { id: paid } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 2,
      status: "paid",
      editedSeconds: 3600,
    });

    await page.goto(`/books/${bookId}`);
    await page.getByTestId("book-detail-enter-selection-mode").click();

    await expect(page.getByTestId(`chapter-select-${paid}`)).toBeDisabled();

    // Select-all picks only the non-paid one.
    await page.getByTestId("chapter-select-all").click();
    await expect(page.getByTestId("chapters-bulk-delete-count")).toHaveText(
      "1 capítulo selecionado",
    );
    await expect(page.getByTestId(`chapter-select-${pending}`)).toBeChecked();
    await expect(page.getByTestId(`chapter-select-${paid}`)).not.toBeChecked();
  });

  test("cancelling the sticky bar exits selection mode and restores action icons", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Cancel Bulk Studio", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Cancelar bulk",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: c1 } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "pending",
    });

    await page.goto(`/books/${bookId}`);
    await page.getByTestId("book-detail-enter-selection-mode").click();
    await expect(page.getByTestId(`chapter-edit-${c1}`)).toHaveCount(0);

    await page.getByTestId("chapters-bulk-delete-cancel").click();
    await expect(page.getByTestId("chapters-bulk-delete-bar")).toHaveCount(0);
    await expect(page.getByTestId(`chapter-edit-${c1}`)).toBeVisible();
  });
});
