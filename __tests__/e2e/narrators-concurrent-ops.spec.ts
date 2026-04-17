import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

async function seedNarrator(page: Page, name: string, email: string) {
  const response = await page.request.post("/api/v1/narrators", {
    data: { name, email },
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed narrator ${email}: ${response.status()}`);
  }
}

test.describe("Narrators: concurrent operations (FR-011)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("two rows in edit mode and the new row coexist", async ({ page }) => {
    await seedNarrator(page, "Alpha", "alpha@example.com");
    await seedNarrator(page, "Beta", "beta@example.com");
    await page.goto("/narrators");

    const rows = page.getByTestId("narrator-row");
    await expect(rows).toHaveCount(2);

    const firstRow = rows.filter({ hasText: /alpha@example\.com|Alpha/ }).first();
    const secondRow = rows.filter({ hasText: /beta@example\.com|Beta/ }).first();

    await firstRow.getByRole("button", { name: /editar alpha/i }).click();
    await secondRow.getByRole("button", { name: /editar beta/i }).click();
    await page.getByRole("button", { name: "Novo narrador", exact: true }).click();

    await expect(page.getByTestId("narrator-new-row")).toBeVisible();

    const editingRows = page.locator(
      '[data-testid="narrator-row"]:has(input[placeholder="Nome do narrador"])',
    );
    await expect(editingRows).toHaveCount(2);
  });

  test("confirming one row edit does not affect other active operations", async ({ page }) => {
    await seedNarrator(page, "Alpha", "alpha@example.com");
    await seedNarrator(page, "Beta", "beta@example.com");
    await page.goto("/narrators");

    // Table is sorted by createdAt DESC → nth(0) = Beta (last), nth(1) = Alpha.
    const betaRow = page.getByTestId("narrator-row").nth(0);
    const alphaRow = page.getByTestId("narrator-row").nth(1);

    await alphaRow.getByRole("button", { name: /editar alpha/i }).click();
    await betaRow.getByRole("button", { name: /editar beta/i }).click();
    await page.getByRole("button", { name: "Novo narrador", exact: true }).click();

    await alphaRow.getByLabel(/nome/i).fill("Alpha Atualizado");
    await alphaRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(
      page.getByTestId("narrator-row").filter({ hasText: "Alpha Atualizado" }),
    ).toBeVisible();
    await expect(page.getByTestId("narrator-new-row")).toBeVisible();
    const remainingEditing = page.locator(
      '[data-testid="narrator-row"]:has(input[placeholder="Nome do narrador"])',
    );
    await expect(remainingEditing).toHaveCount(1);
  });
});
