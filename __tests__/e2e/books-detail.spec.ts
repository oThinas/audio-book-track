import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { closeSeedPool, seedBook, seedChapter, seedStudio } from "./helpers/seed";

test.afterAll(async () => {
  await closeSeedPool();
});

test.describe("Books detail", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("clicking a row navigates to the detail page with header and chapters", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Dom Casmurro",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    for (let i = 1; i <= 3; i += 1) {
      await seedChapter({
        schema: appServer.schemaName,
        bookId,
        number: i,
        status: i === 1 ? "completed" : "pending",
        editedSeconds: i === 1 ? 3600 : 0,
      });
    }

    await page.goto("/books");
    await page.getByTestId(`book-row-${bookId}`).click();

    await expect(page).toHaveURL(new RegExp(`/books/${bookId}$`));
    await expect(page.getByRole("heading", { name: /dom casmurro/i })).toBeVisible();
    await expect(page.getByTestId("book-detail-studio")).toContainText(/sonora/i);
    await expect(page.getByTestId("book-detail-price")).toContainText("R$ 75,00");
    await expect(page.getByTestId("book-detail-chapters-summary")).toContainText("1/3");

    const rows = page.locator('[data-testid^="chapter-row-"]');
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText("1");
  });

  test("back button returns to the books list", async ({ page, appServer }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Memórias",
      studioId: studio.id,
      pricePerHourCents: 6000,
    });
    await seedChapter({ schema: appServer.schemaName, bookId, number: 1, status: "pending" });

    await page.goto(`/books/${bookId}`);
    await expect(page.getByRole("heading", { name: /memórias/i })).toBeVisible();

    await page.getByTestId("book-detail-back").click();
    await expect(page).toHaveURL(/\/books$/);
  });

  test("returns 404 page for unknown book id", async ({ page }) => {
    const response = await page.goto(`/books/${crypto.randomUUID()}`);
    expect(response?.status()).toBe(404);
  });
});
