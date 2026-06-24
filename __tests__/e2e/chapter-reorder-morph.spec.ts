import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { closeSeedPool, seedBook, seedChapter, seedStudio } from "./helpers/seed";

test.afterAll(async () => {
  await closeSeedPool();
});

/**
 * US5 — chapter rows morph to their new position on reorder (each row wrapped
 * in a per-row <ViewTransition>; the optimistic update runs in startTransition).
 * The morph must not regress the reorder itself: new order persists and the
 * version token advances. Under reduced motion the move is instant.
 */
test.describe("Page transitions — US5 — chapter reorder morph", () => {
  test.beforeEach(async ({ page }) => {
    // Mobile viewport exposes the per-row up/down arrows (drag is flaky headless).
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
  });

  async function seedThreeChapterBook(schema: string, page: import("@playwright/test").Page) {
    const studio = await seedStudio(page, "Reorder Morph", 75);
    const { id: bookId } = await seedBook({
      schema,
      title: "Reorder Morph Book",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: c1 } = await seedChapter({ schema, bookId, number: 1, status: "pending" });
    await seedChapter({ schema, bookId, number: 2, status: "pending" });
    await seedChapter({ schema, bookId, number: 3, status: "pending" });
    return { bookId, c1 };
  }

  test("moving a row down repositions it and persists the new order", async ({
    page,
    appServer,
  }) => {
    const { bookId, c1 } = await seedThreeChapterBook(appServer.schemaName, page);

    await page.goto(`/books/${bookId}`);
    await expect(page.getByTestId(`chapter-row-${c1}`)).toBeVisible();

    const rows = page.locator('[data-testid^="chapter-row-"]');
    await expect(rows.first()).toContainText("Capítulo 1");

    // Move Capítulo 1 down → order becomes 2, 1, 3; PUT must succeed.
    const [reorderResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/books/${bookId}/chapters/order`) &&
          res.request().method() === "PUT",
      ),
      page.getByTestId(`chapter-move-down-${c1}`).click(),
    ]);
    expect(reorderResponse.status()).toBe(200);

    await expect(rows.first()).toContainText("Capítulo 2");

    // Order persists across a full reload (expectedVersion path intact).
    await page.reload();
    await expect(page.locator('[data-testid^="chapter-row-"]').first()).toContainText("Capítulo 2");
  });

  test("reorder works instantly under reduced motion", async ({ page, appServer }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { bookId, c1 } = await seedThreeChapterBook(appServer.schemaName, page);

    await page.goto(`/books/${bookId}`);
    await expect(page.getByTestId(`chapter-row-${c1}`)).toBeVisible();

    const [reorderResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/books/${bookId}/chapters/order`) &&
          res.request().method() === "PUT",
      ),
      page.getByTestId(`chapter-move-down-${c1}`).click(),
    ]);
    expect(reorderResponse.status()).toBe(200);
    await expect(page.locator('[data-testid^="chapter-row-"]').first()).toContainText("Capítulo 2");
  });
});
