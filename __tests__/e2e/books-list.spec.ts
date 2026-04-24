import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { closeSeedPool, seedBook, seedStudio } from "./helpers/seed";

test.afterAll(async () => {
  await closeSeedPool();
});

test.describe("Books list", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("shows in-table empty state when no books exist", async ({ page }) => {
    await page.goto("/books");

    await expect(page.getByRole("heading", { name: /^livros$/i })).toBeVisible();
    await expect(page.getByTestId("books-empty-state")).toBeVisible();
    await expect(page.getByTestId("books-empty-state")).toContainText(/nenhum livro cadastrado/i);
  });

  test("page uses PageContainer layout with New button", async ({ page }) => {
    await page.goto("/books");

    await expect(page.getByRole("heading", { name: /^livros$/i })).toBeVisible();
    await expect(page.getByTestId("books-new-button")).toBeVisible();
  });

  test("renders the table with aggregated data and no Ações column", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    await seedBook({
      schema: appServer.schemaName,
      title: "Dom Casmurro",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });

    await page.goto("/books");

    await expect(page.getByTestId("books-scroll-area")).toBeVisible();
    await expect(page.getByRole("button", { name: /^título$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^estúdio$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^capítulos$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^status$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^r\$\/hora$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /ganho total/i })).toBeVisible();

    // "Ações" column must not exist
    await expect(page.getByRole("columnheader", { name: /ações/i })).toHaveCount(0);

    // Book row visible with formatted rate
    await expect(page.getByRole("cell", { name: /dom casmurro/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: "R$ 75,00" })).toBeVisible();
  });

  test("search filter narrows by title or studio name", async ({ page, appServer }) => {
    const sonora = await seedStudio(page, "Sonora", 75);
    const outro = await seedStudio(page, "Outro Estúdio", 60);
    await seedBook({
      schema: appServer.schemaName,
      title: "Dom Casmurro",
      studioId: sonora.id,
      pricePerHourCents: 7500,
    });
    await seedBook({
      schema: appServer.schemaName,
      title: "Memórias Póstumas",
      studioId: outro.id,
      pricePerHourCents: 6000,
    });

    await page.goto("/books");

    await expect(page.getByRole("cell", { name: /dom casmurro/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: /memórias póstumas/i })).toBeVisible();

    const searchInput = page.getByTestId("books-search-input");

    await searchInput.fill("casmurro");
    await expect(page.getByRole("cell", { name: /dom casmurro/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: /memórias póstumas/i })).toHaveCount(0);

    await searchInput.fill("outro");
    await expect(page.getByRole("cell", { name: /memórias póstumas/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: /dom casmurro/i })).toHaveCount(0);

    await searchInput.fill("nada-combina");
    await expect(page.getByTestId("books-empty-state")).toBeVisible();
  });

  test("title column sorts ASC then DESC", async ({ page, appServer }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    await seedBook({
      schema: appServer.schemaName,
      title: "Alpha",
      studioId: studio.id,
      pricePerHourCents: 7500,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    await seedBook({
      schema: appServer.schemaName,
      title: "Beta",
      studioId: studio.id,
      pricePerHourCents: 7500,
      createdAt: new Date("2026-02-01T00:00:00Z"),
    });
    await seedBook({
      schema: appServer.schemaName,
      title: "Gamma",
      studioId: studio.id,
      pricePerHourCents: 7500,
      createdAt: new Date("2026-03-01T00:00:00Z"),
    });

    await page.goto("/books");

    const rows = page.locator('[data-testid^="book-row-"]');
    await expect(rows).toHaveCount(3);

    // Default: createdAt DESC → Gamma, Beta, Alpha
    await expect(rows.first()).toContainText("Gamma");
    await expect(rows.last()).toContainText("Alpha");

    const titleHeader = page.getByRole("button", { name: /^título$/i });
    await titleHeader.click();
    await expect(rows.first()).toContainText("Alpha");
    await expect(rows.last()).toContainText("Gamma");

    await titleHeader.click();
    await expect(rows.first()).toContainText("Gamma");
    await expect(rows.last()).toContainText("Alpha");
  });
});
