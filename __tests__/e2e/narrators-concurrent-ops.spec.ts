import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

async function seedNarrator(page: Page, name: string) {
  const response = await page.request.post("/api/v1/narrators", {
    data: { name },
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed narrator ${name}: ${response.status()}`);
  }
}

test.describe("Narrators: concurrent operations (FR-011)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("two rows in edit mode and the new row coexist", async ({ page }) => {
    await seedNarrator(page, "Alpha");
    await seedNarrator(page, "Beta");
    await page.goto("/narrators");

    const rows = page.getByTestId("narrator-row");
    await expect(rows).toHaveCount(2);

    const firstRow = rows.filter({ hasText: "Alpha" }).first();
    const secondRow = rows.filter({ hasText: "Beta" }).first();

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
    await seedNarrator(page, "Alpha");
    await seedNarrator(page, "Beta");
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
