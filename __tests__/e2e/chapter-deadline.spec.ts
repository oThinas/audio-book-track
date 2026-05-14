import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { closeSeedPool, seedBook, seedChapter, seedStudio } from "./helpers/seed";

test.afterAll(async () => {
  await closeSeedPool();
});

test.describe("Chapter: deadline (feature 025)", () => {
  test("'Foco da semana' badge appears in /books when a chapter is eligible", async ({
    page,
    appServer,
  }) => {
    await login(page);

    const studio = await seedStudio(page, "Studio 025", 85);
    const book = await seedBook({
      schema: appServer.schemaName,
      studioId: studio.id,
      title: "Book with deadline",
      pricePerHourCents: 8500,
    });

    await seedChapter({
      schema: appServer.schemaName,
      bookId: book.id,
      number: 1,
      status: "pending",
    });

    await page.goto("/books");
    const row = page.getByTestId(`book-row-${book.id}`);
    await expect(row).toBeVisible();
    await expect(row.getByText(/Foco da semana ·/)).toHaveCount(0);

    await seedChapter({
      schema: appServer.schemaName,
      bookId: book.id,
      number: 2,
      status: "editing",
      deadline: "2020-01-01",
    });

    await page.goto("/books");
    await expect(
      page.getByTestId(`book-row-${book.id}`).getByText(/Foco da semana · 1/),
    ).toBeVisible();
  });

  test("'Foco da semana' filter activates via URL and toggles off via the button", async ({
    page,
    appServer,
  }) => {
    await login(page);

    const studio = await seedStudio(page, "Studio 025", 85);
    const book = await seedBook({
      schema: appServer.schemaName,
      studioId: studio.id,
      title: "Book filter",
      pricePerHourCents: 8500,
    });

    await seedChapter({
      schema: appServer.schemaName,
      bookId: book.id,
      number: 1,
      status: "pending",
      deadline: "2020-01-01",
    });
    await seedChapter({
      schema: appServer.schemaName,
      bookId: book.id,
      number: 2,
      status: "pending",
      deadline: null,
    });

    await page.goto(`/books/${book.id}?focus=week`);

    const toggle = page.getByRole("button", { name: /foco da semana/i });
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    const rows = page.locator('[data-testid^="chapter-row-"][data-mode="view"]');
    await expect(rows).toHaveCount(1);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(rows).toHaveCount(2);
    await expect(page).toHaveURL(new RegExp(`/books/${book.id}$`));
  });
});
