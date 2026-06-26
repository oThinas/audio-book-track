import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./fixtures/app-server";
import { checkAccessibility } from "./helpers/accessibility";
import { login } from "./helpers/auth";
import { closeSeedPool, seedBook, seedChapter, seedStudio } from "./helpers/seed";

test.afterAll(async () => {
  await closeSeedPool();
});

// Seeds a book whose chapters span several statuses so the grouped chapters
// table renders its group rows — the surface exercised by US3 (td-has-header)
// and US4 (label-content-name-mismatch on the group toggle). Mirrors the
// diagnostic seed (scripts/diagnostics/seed.ts) used by the Lighthouse gate.
async function seedBookWithChapters(
  page: Parameters<typeof seedStudio>[0],
  schema: string,
): Promise<{ bookId: string }> {
  const studio = await seedStudio(page, "A11y Studio", 90);
  const { id: bookId } = await seedBook({
    schema,
    title: "Livro A11y",
    studioId: studio.id,
    pricePerHourCents: 9000,
  });

  const chapters: ReadonlyArray<{
    status: "completed" | "reviewing" | "editing" | "pending";
    edited: number;
  }> = [
    { status: "completed", edited: 3600 },
    { status: "reviewing", edited: 1800 },
    { status: "editing", edited: 600 },
    { status: "pending", edited: 0 },
  ];
  for (let position = 0; position < chapters.length; position += 1) {
    const spec = chapters[position];
    await seedChapter({
      schema,
      bookId,
      position,
      status: spec.status,
      editedSeconds: spec.edited,
    });
  }

  return { bookId };
}

test.describe("Accessibility: Books", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("books list page - WCAG 2.1 AA across themes and colors", async ({ page, appServer }) => {
    await seedBookWithChapters(page, appServer.schemaName);

    await page.goto("/books");
    await expect(page.getByRole("heading", { name: /livros/i })).toBeVisible();

    await checkAccessibility(page, "books-list");
  });

  test("book detail page - WCAG 2.1 AA across themes and colors", async ({ page, appServer }) => {
    const { bookId } = await seedBookWithChapters(page, appServer.schemaName);

    await page.goto(`/books/${bookId}`);
    await expect(page.getByRole("heading", { name: /livro a11y/i })).toBeVisible();
    await expect(page.locator('[data-testid^="chapter-row-"]').first()).toBeVisible();

    await checkAccessibility(page, "books-detail");
  });

  // US3 (D1): td-has-header is a best-practice rule (moderate impact) outside the
  // wcag2a/aa tag set the shared helper filters on, so assert it directly on the
  // chapters table.
  test("chapters table has no td-has-header violations", async ({ page, appServer }) => {
    const { bookId } = await seedBookWithChapters(page, appServer.schemaName);

    await page.goto(`/books/${bookId}`);
    await expect(page.locator('[data-testid^="chapter-row-"]').first()).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[data-slot="table"]')
      .withRules(["td-has-header"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
