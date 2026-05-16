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

    // Step 1: basic info.
    await dialog.getByLabel(/^título$/i).fill("Dom Casmurro");

    await dialog.getByTestId("book-studio-trigger").click();
    await page.getByRole("option", { name: /sonora/i }).click();

    // Studio selection auto-fills Valor/hora with the studio's default rate.
    const priceInput = dialog.getByLabel(/^valor\/hora$/i);
    await expect(priceInput).toHaveValue(/R\$\s*75,00/);

    // Advance to step 2.
    await dialog.getByTestId("book-create-next").click();
    await expect(dialog).toHaveAttribute("data-step", "2");

    const chaptersInput = dialog.getByLabel(/^capítulos numerados$/i);
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

  test("advance to step 2 is disabled until step 1 fields are filled", async ({ page }) => {
    await seedStudio(page, "Sonora", 75);
    await page.goto("/books");

    await page.getByTestId("books-new-button").click();
    const dialog = page.getByTestId("book-create-dialog");
    const next = dialog.getByTestId("book-create-next");

    await expect(next).toBeDisabled();

    await dialog.getByLabel(/^título$/i).fill("Um Livro");
    await expect(next).toBeDisabled();

    // Selecting the studio auto-fills Valor/hora with the studio's default
    // rate, which satisfies the remaining required step-1 field.
    await dialog.getByTestId("book-studio-trigger").click();
    await page.getByRole("option", { name: /sonora/i }).click();

    await expect(next).toBeEnabled();
  });

  test("shows inline error and snaps back to step 1 when title collides (409)", async ({
    page,
  }) => {
    const studio = await seedStudio(page, "Sonora", 75);

    const seedResponse = await page.request.post("/api/v1/books", {
      data: {
        title: "Dom Casmurro",
        studioId: studio.id,
        pricePerHourCents: 7500,
        chapters: { numbered: 1, extras: [] },
      },
    });
    expect(seedResponse.status()).toBe(201);

    await page.goto("/books");
    await page.getByTestId("books-new-button").click();
    const dialog = page.getByTestId("book-create-dialog");

    await dialog.getByLabel(/^título$/i).fill("dom casmurro");
    await dialog.getByTestId("book-studio-trigger").click();
    await page.getByRole("option", { name: /sonora/i }).click();
    // Price auto-fills from the studio's default rate; no manual entry needed.

    await dialog.getByTestId("book-create-next").click();
    await expect(dialog).toHaveAttribute("data-step", "2");

    await dialog.getByTestId("book-create-submit").click();

    // After the 409, the dialog auto-navigates back to step 1 to surface the
    // field error on `title`.
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("data-step", "1");
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
