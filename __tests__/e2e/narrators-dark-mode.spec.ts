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

test.describe("Narrators: dark mode", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("table, edit row and delete dialog render in dark mode", async ({ page }) => {
    await seedNarrator(page, "Dark Mode Subject", "dark@example.com");

    await page.goto("/settings");
    await page.getByText("Escuro", { exact: true }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.goto("/narrators");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByTestId("narrators-scroll-area")).toBeVisible();

    const row = page.getByTestId("narrator-row").first();
    await row.getByRole("button", { name: /editar dark mode subject/i }).click();
    await expect(row.getByLabel(/nome/i)).toBeVisible();
    await row.getByRole("button", { name: /cancelar/i }).click();

    await row.getByRole("button", { name: /excluir dark mode subject/i }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
  });
});
