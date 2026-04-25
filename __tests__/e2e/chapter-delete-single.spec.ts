import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { closeSeedPool, seedBook, seedChapter, seedStudio } from "./helpers/seed";

test.afterAll(async () => {
  await closeSeedPool();
});

test.describe("Chapter single-delete", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("opens confirm dialog, deletes a non-last chapter and reduces the row count", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Dois capítulos",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: c1 } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "pending",
    });
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 2,
      status: "completed",
      editedSeconds: 3600,
    });

    await page.goto(`/books/${bookId}`);

    // Click the trash icon to open the AlertDialog (rendered in a portal).
    await page.getByTestId(`chapter-delete-${c1}`).click();
    const dialog = page.getByTestId("chapter-delete-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Excluir capítulo 1");

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/chapters/${c1}`) && res.request().method() === "DELETE",
      ),
      dialog.getByTestId("chapter-delete-confirm").click(),
    ]);
    expect(response.status()).toBe(204);
    expect(response.headers()["x-book-deleted"]).toBeUndefined();

    // The deleted row is gone; one chapter remains.
    await expect(page.getByTestId(`chapter-row-${c1}`)).toHaveCount(0);
    await expect(page.getByTestId("chapters-scroll-area").getByRole("row")).toHaveCount(2); // header + 1
  });

  test("cascade-deletes the book and redirects to /books when removing the last chapter", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora Cascade", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Um capítulo só",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: only } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "pending",
    });

    await page.goto(`/books/${bookId}`);

    await page.getByTestId(`chapter-delete-${only}`).click();
    const dialog = page.getByTestId("chapter-delete-dialog");
    await expect(dialog).toContainText(/livro/i);

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/chapters/${only}`) && res.request().method() === "DELETE",
      ),
      dialog.getByTestId("chapter-delete-confirm").click(),
    ]);
    expect(response.status()).toBe(204);
    expect(response.headers()["x-book-deleted"]).toBe("true");

    // Redirect to /books and the book is no longer listed.
    await page.waitForURL("**/books", { timeout: 5_000 });
    await expect(page.getByRole("cell", { name: /um capítulo só/i })).toHaveCount(0);
  });

  test("the trash icon is disabled for paid chapters", async ({ page, appServer }) => {
    const studio = await seedStudio(page, "Sonora Paid Lock", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Tem pago",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: paidId } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "paid",
      editedSeconds: 3600,
    });

    await page.goto(`/books/${bookId}`);
    await expect(page.getByTestId(`chapter-delete-${paidId}`)).toBeDisabled();
  });
});
