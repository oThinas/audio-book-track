import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { closeSeedPool, seedBook, seedChapter, seedStudio } from "./helpers/seed";

const CHAPTER_COUNT = 30;
const MAX_HEIGHT_VIEWPORT_RATIO = 0.6; // chapters-scroll-area uses max-h-[60vh]
const BOX_TOLERANCE_PX = 1;

test.afterAll(async () => {
  await closeSeedPool();
});

test.describe("Chapters table scroll", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("with many chapters the table scrolls inside its container instead of overflowing", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Livro Longo",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    for (let position = 0; position < CHAPTER_COUNT; position += 1) {
      await seedChapter({ schema: appServer.schemaName, bookId, position });
    }

    await page.goto(`/books/${bookId}`);
    const rows = page.locator('[data-testid^="chapter-row-"]');
    await expect(rows).toHaveCount(CHAPTER_COUNT);
    // With the route loading.tsx present, content streams into the DOM behind
    // the Suspense fallback before the swap; wait for the first row to be
    // visible so height/box measurements run against painted layout.
    await expect(rows.first()).toBeVisible();

    const container = page.getByTestId("chapters-scroll-area");
    const viewport = container.locator('[data-slot="scroll-area-viewport"]');

    // The viewport must be vertically scrollable: its content overflows its
    // own height. Regression guard — when the max-height chain is broken the
    // viewport grows with the content and scrollHeight === clientHeight.
    const metrics = await viewport.evaluate((el) => ({
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
    }));
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

    // The scrollable area respects the 60vh cap instead of growing with rows.
    const windowHeight = await page.evaluate(() => window.innerHeight);
    expect(metrics.clientHeight).toBeLessThanOrEqual(
      windowHeight * MAX_HEIGHT_VIEWPORT_RATIO + BOX_TOLERANCE_PX,
    );

    // Scrolling reaches the last chapter and it renders within the container
    // bounds — rows never paint past the table border.
    await rows.last().scrollIntoViewIfNeeded();
    const containerBox = await container.boundingBox();
    const lastRowBox = await rows.last().boundingBox();
    expect(containerBox).not.toBeNull();
    expect(lastRowBox).not.toBeNull();
    if (!containerBox || !lastRowBox) return;
    expect(lastRowBox.y + lastRowBox.height).toBeLessThanOrEqual(
      containerBox.y + containerBox.height + BOX_TOLERANCE_PX,
    );
    expect(lastRowBox.y).toBeGreaterThanOrEqual(containerBox.y - BOX_TOLERANCE_PX);
  });
});
