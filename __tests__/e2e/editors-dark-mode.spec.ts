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

test.describe("Editors: dark mode", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("table, edit row and delete dialog render in dark mode", async ({ page }) => {
    await seedEditor(page, "Dark Mode Editor", "dark@studio.com");

    await page.goto("/settings");
    await page.getByText("Escuro", { exact: true }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.goto("/editors");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByTestId("editors-scroll-area")).toBeVisible();

    const row = page.getByTestId("editor-row").first();
    await row.getByRole("button", { name: /editar dark mode editor/i }).click();
    await expect(row.getByLabel(/^nome$/i)).toBeVisible();
    await expect(row.getByLabel(/^e-mail$/i)).toBeVisible();
    await row.getByRole("button", { name: /cancelar/i }).click();

    await row.getByRole("button", { name: /excluir dark mode editor/i }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
  });
});
