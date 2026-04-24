import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

async function seedStudio(
  page: Page,
  name: string,
  defaultHourlyRateReais: number,
): Promise<{ id: string }> {
  const response = await page.request.post("/api/v1/studios", {
    data: { name, defaultHourlyRateCents: Math.round(defaultHourlyRateReais * 100) },
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed studio ${name}: ${response.status()}`);
  }
  const body = (await response.json()) as { data: { id: string } };
  return { id: body.data.id };
}

test.describe("Books create", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("opens dialog, fills the form and creates a book visible on the list", async ({ page }) => {
    await seedStudio(page, "Sonora", 75);
    await page.goto("/books");

    await page.getByTestId("books-new-button").click();

    const dialog = page.getByTestId("book-create-dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/^título$/i).fill("Dom Casmurro");

    await dialog.getByTestId("book-studio-trigger").click();
    await page.getByRole("option", { name: /sonora/i }).click();

    const priceInput = dialog.getByLabel(/^valor\/hora$/i);
    await priceInput.focus();
    await page.keyboard.type("7500");
    await expect(priceInput).toHaveValue(/R\$\s*75,00/);

    const chaptersInput = dialog.getByLabel(/quantidade de capítulos/i);
    await chaptersInput.fill("5");

    const [postResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().endsWith("/api/v1/books") && res.request().method() === "POST",
      ),
      dialog.getByTestId("book-create-submit").click(),
    ]);
    expect(postResponse.status()).toBe(201);

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("cell", { name: /dom casmurro/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: /sonora/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: "R$ 75,00" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "0/5" })).toBeVisible();
  });

  test("submit is disabled until all required fields are valid", async ({ page }) => {
    await seedStudio(page, "Sonora", 75);
    await page.goto("/books");

    await page.getByTestId("books-new-button").click();
    const dialog = page.getByTestId("book-create-dialog");
    const submit = dialog.getByTestId("book-create-submit");

    await expect(submit).toBeDisabled();

    await dialog.getByLabel(/^título$/i).fill("Um Livro");
    await expect(submit).toBeDisabled();

    await dialog.getByTestId("book-studio-trigger").click();
    await page.getByRole("option", { name: /sonora/i }).click();
    await expect(submit).toBeDisabled();

    const priceInput = dialog.getByLabel(/^valor\/hora$/i);
    await priceInput.focus();
    await page.keyboard.type("7500");

    await expect(submit).toBeEnabled();
  });

  test("shows inline error when title collides in the same studio (409)", async ({ page }) => {
    const studio = await seedStudio(page, "Sonora", 75);

    const seedResponse = await page.request.post("/api/v1/books", {
      data: {
        title: "Dom Casmurro",
        studioId: studio.id,
        pricePerHourCents: 7500,
        numChapters: 1,
      },
    });
    expect(seedResponse.status()).toBe(201);

    await page.goto("/books");
    await page.getByTestId("books-new-button").click();
    const dialog = page.getByTestId("book-create-dialog");

    await dialog.getByLabel(/^título$/i).fill("dom casmurro");
    await dialog.getByTestId("book-studio-trigger").click();
    await page.getByRole("option", { name: /sonora/i }).click();
    const priceInput = dialog.getByLabel(/^valor\/hora$/i);
    await priceInput.focus();
    await page.keyboard.type("6000");

    await dialog.getByTestId("book-create-submit").click();

    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/já existe um livro com este título/i)).toBeVisible();
  });

  test("cancel closes the dialog without creating a book", async ({ page }) => {
    await seedStudio(page, "Sonora", 75);
    await page.goto("/books");

    await page.getByTestId("books-new-button").click();
    const dialog = page.getByTestId("book-create-dialog");
    await dialog.getByLabel(/^título$/i).fill("Never Created");
    await dialog.getByRole("button", { name: /cancelar/i }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("cell", { name: /never created/i })).toHaveCount(0);
  });
});
