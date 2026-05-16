import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { closeSeedPool, seedBook, seedChapter, seedStudio } from "./helpers/seed";

test.afterAll(async () => {
  await closeSeedPool();
});

test.describe("Chapter reorder followed by add (chaptersVersion lifted state)", () => {
  test.beforeEach(async ({ page }) => {
    // Mobile viewport so the per-row move-up/move-down arrows are visible.
    // Reorder via the drag handle is unreliable in headless Playwright.
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
  });

  test("reorder bumps chaptersVersion on the client; subsequent add succeeds with the new token", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Reorder Then Add", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Reorder Then Add Book",
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
      status: "pending",
    });

    await page.goto(`/books/${bookId}`);
    await expect(page.getByTestId(`chapter-row-${c1}`)).toBeVisible();

    // Move Capítulo 1 down → PUT /api/v1/books/:id/chapters/order, version V → V+1.
    const [reorderResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/books/${bookId}/chapters/order`) &&
          res.request().method() === "PUT",
      ),
      page.getByTestId(`chapter-move-down-${c1}`).click(),
    ]);
    expect(reorderResponse.status()).toBe(200);
    const reorderBody = (await reorderResponse.json()) as {
      data: { chaptersVersion: number };
    };
    expect(reorderBody.data.chaptersVersion).toBeGreaterThan(0);

    // Open the AddChapterDialog. Defaults: kind=numbered, position=end.
    // If the bug regresses, the dialog will still hold the stale (pre-reorder)
    // token and the POST below will return 409 BOOK_CHAPTERS_VERSION_CONFLICT.
    await page.getByTestId("add-chapter-open").click();
    await expect(page.getByTestId("add-chapter-dialog")).toBeVisible();

    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/books/${bookId}/chapters`) &&
          !res.url().includes("/order") &&
          !res.url().includes("/bulk-delete") &&
          res.request().method() === "POST",
      ),
      page.getByTestId("add-chapter-submit").click(),
    ]);

    expect(createResponse.status()).toBe(201);
    const createPayload = createResponse.request().postDataJSON() as {
      expectedVersion: number;
    };
    expect(createPayload.expectedVersion).toBe(reorderBody.data.chaptersVersion);

    // Dialog closes and the new chapter (Capítulo 3) appears.
    await expect(page.getByTestId("add-chapter-dialog")).toBeHidden();
    await expect(page.getByText("Capítulo 3", { exact: true })).toBeVisible();

    // No conflict toast was raised.
    await expect(page.getByText(/Outro usuário alterou os capítulos deste livro/i)).toHaveCount(0);
  });
});
