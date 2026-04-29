import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

async function seedStudio(page: Page, name: string, defaultHourlyRateReais: number) {
  const response = await page.request.post("/api/v1/studios", {
    data: { name, defaultHourlyRateCents: Math.round(defaultHourlyRateReais * 100) },
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed studio ${name}: ${response.status()}`);
  }
}

test.describe("Studios: concurrent operations (FR-011)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("two rows in edit mode and the new row coexist", async ({ page }) => {
    await seedStudio(page, "Alpha", 50);
    await seedStudio(page, "Beta", 60);
    await page.goto("/studios");

    const rows = page.getByTestId("studio-row");
    await expect(rows).toHaveCount(2);

    const firstRow = rows.filter({ hasText: "Alpha" }).first();
    const secondRow = rows.filter({ hasText: "Beta" }).first();

    await firstRow.getByRole("button", { name: /editar alpha/i }).click();
    await secondRow.getByRole("button", { name: /editar beta/i }).click();
    await page.getByRole("button", { name: "Novo estúdio", exact: true }).click();

    await expect(page.getByTestId("studio-new-row")).toBeVisible();

    const editingRows = page.locator(
      '[data-testid="studio-row"]:has(input[placeholder="Nome do estúdio"])',
    );
    await expect(editingRows).toHaveCount(2);
  });

  test("confirming one row edit does not affect other active operations", async ({ page }) => {
    await seedStudio(page, "Alpha", 50);
    await seedStudio(page, "Beta", 60);
    await page.goto("/studios");

    // Table is sorted by createdAt DESC → nth(0) = Beta (last), nth(1) = Alpha.
    const betaRow = page.getByTestId("studio-row").nth(0);
    const alphaRow = page.getByTestId("studio-row").nth(1);

    await alphaRow.getByRole("button", { name: /editar alpha/i }).click();
    await betaRow.getByRole("button", { name: /editar beta/i }).click();
    await page.getByRole("button", { name: "Novo estúdio", exact: true }).click();

    await alphaRow.getByLabel(/^nome$/i).fill("Alpha Atualizado");
    await alphaRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(
      page.getByTestId("studio-row").filter({ hasText: "Alpha Atualizado" }),
    ).toBeVisible();
    await expect(page.getByTestId("studio-new-row")).toBeVisible();
    const remainingEditing = page.locator(
      '[data-testid="studio-row"]:has(input[placeholder="Nome do estúdio"])',
    );
    await expect(remainingEditing).toHaveCount(1);
  });
});
