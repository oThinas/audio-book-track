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

test.describe("Editors delete", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("confirming the dialog removes the row", async ({ page }) => {
    await seedEditor(page, "Editor Para Excluir", "del@studio.com");
    await page.goto("/editors");

    const row = page.getByTestId("editor-row").filter({ hasText: "Editor Para Excluir" });
    await row.getByRole("button", { name: /excluir editor para excluir/i }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/editor para excluir/i);

    await dialog.getByRole("button", { name: /^excluir$/i }).click();

    await expect(
      page.getByTestId("editor-row").filter({ hasText: "Editor Para Excluir" }),
    ).toHaveCount(0);
    await expect(dialog).toBeHidden();
  });

  test("cancelling the dialog keeps the row and closes the dialog", async ({ page }) => {
    await seedEditor(page, "Editor Mantido", "mantido@studio.com");
    await page.goto("/editors");

    const row = page.getByTestId("editor-row").filter({ hasText: "Editor Mantido" });
    await row.getByRole("button", { name: /excluir editor mantido/i }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: /cancelar/i }).click();

    await expect(dialog).toBeHidden();
    await expect(
      page.getByTestId("editor-row").filter({ hasText: "Editor Mantido" }),
    ).toBeVisible();
  });
});
