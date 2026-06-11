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

  test("renders the not-found page for unknown book id", async ({ page }) => {
    // With the route loading.tsx present, the server commits HTTP 200 to start
    // streaming the shell; notFound() then fires mid-stream and renders the
    // not-found UI client-side (the HTTP status stays 200 — Next.js streaming
    // contract). Assert the rendered UI rather than the response status.
    await page.goto(`/books/${crypto.randomUUID()}`);
    await expect(page.getByTestId("not-found-message")).toBeVisible();
  });

  test("double-clicking the status cell enters edit mode and opens the status dropdown", async ({
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
      status: "editing",
      editedSeconds: 0,
    });

    await page.goto(`/books/${bookId}`);
    const row = page.getByTestId(`chapter-row-${chapterId}`);
    await expect(row).toHaveAttribute("data-mode", "view");

    // SC-001: a single double-click both enters edit mode AND opens the dropdown.
    await page.getByTestId(`chapter-cell-status-${chapterId}`).dblclick();

    await expect(row).toHaveAttribute("data-mode", "edit");
    await expect(page.getByRole("option", { name: "Em revisão" })).toBeVisible();
  });
});
