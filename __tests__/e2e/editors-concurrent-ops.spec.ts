import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

async function seedEditor(page: Page, name: string, email: string) {
  const response = await page.request.post("/api/v1/editors", {
    data: { name, email },
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed editor ${name}: ${response.status()}`);
  }
}

test.describe("Editors: concurrent operations (FR-011)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("two rows in edit mode and the new row coexist", async ({ page }) => {
    await seedEditor(page, "Alpha", "alpha@studio.com");
    await seedEditor(page, "Beta", "beta@studio.com");
    await page.goto("/editors");

    const rows = page.getByTestId("editor-row");
    await expect(rows).toHaveCount(2);

    const firstRow = rows.filter({ hasText: "Alpha" }).first();
    const secondRow = rows.filter({ hasText: "Beta" }).first();

    await firstRow.getByRole("button", { name: /editar alpha/i }).click();
    await secondRow.getByRole("button", { name: /editar beta/i }).click();
    await page.getByRole("button", { name: "Novo editor", exact: true }).click();

    await expect(page.getByTestId("editor-new-row")).toBeVisible();

    const editingRows = page.locator(
      '[data-testid="editor-row"]:has(input[placeholder="Nome do editor"])',
    );
    await expect(editingRows).toHaveCount(2);
  });

  test("confirming one row edit does not affect other active operations", async ({ page }) => {
    await seedEditor(page, "Alpha", "alpha@studio.com");
    await seedEditor(page, "Beta", "beta@studio.com");
    await page.goto("/editors");

    // Table is sorted by createdAt DESC → nth(0) = Beta (last), nth(1) = Alpha.
    const betaRow = page.getByTestId("editor-row").nth(0);
    const alphaRow = page.getByTestId("editor-row").nth(1);

    await alphaRow.getByRole("button", { name: /editar alpha/i }).click();
    await betaRow.getByRole("button", { name: /editar beta/i }).click();
    await page.getByRole("button", { name: "Novo editor", exact: true }).click();

    await alphaRow.getByLabel(/^nome$/i).fill("Alpha Atualizado");
    await alphaRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(
      page.getByTestId("editor-row").filter({ hasText: "Alpha Atualizado" }),
    ).toBeVisible();
    await expect(page.getByTestId("editor-new-row")).toBeVisible();
    const remainingEditing = page.locator(
      '[data-testid="editor-row"]:has(input[placeholder="Nome do editor"])',
    );
    await expect(remainingEditing).toHaveCount(1);
  });
});
