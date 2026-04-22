import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

async function seedStudio(page: Page, name: string, defaultHourlyRate: number) {
  const response = await page.request.post("/api/v1/studios", {
    data: { name, defaultHourlyRate },
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed studio ${name}: ${response.status()}`);
  }
}

test.describe("Studios: dark mode", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("table, edit row and delete dialog render in dark mode", async ({ page }) => {
    await seedStudio(page, "Dark Mode Studio", 85);

    await page.goto("/settings");
    await page.getByText("Escuro", { exact: true }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.goto("/studios");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByTestId("studios-scroll-area")).toBeVisible();

    const row = page.getByTestId("studio-row").first();
    await row.getByRole("button", { name: /editar dark mode studio/i }).click();
    await expect(row.getByLabel(/^nome$/i)).toBeVisible();
    await expect(row.getByLabel(/^valor\/hora$/i)).toBeVisible();
    await row.getByRole("button", { name: /cancelar/i }).click();

    await row.getByRole("button", { name: /excluir dark mode studio/i }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
  });
});
