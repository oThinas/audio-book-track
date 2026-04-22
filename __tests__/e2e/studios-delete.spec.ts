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

test.describe("Studios delete", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("confirming the dialog removes the row", async ({ page }) => {
    await seedStudio(page, "Studio Para Excluir", 85);
    await page.goto("/studios");

    const row = page.getByTestId("studio-row").filter({ hasText: "Studio Para Excluir" });
    await row.getByRole("button", { name: /excluir studio para excluir/i }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/studio para excluir/i);

    await dialog.getByRole("button", { name: /^excluir$/i }).click();

    await expect(
      page.getByTestId("studio-row").filter({ hasText: "Studio Para Excluir" }),
    ).toHaveCount(0);
    await expect(dialog).toBeHidden();
  });

  test("cancelling the dialog keeps the row and closes the dialog", async ({ page }) => {
    await seedStudio(page, "Studio Mantido", 90);
    await page.goto("/studios");

    const row = page.getByTestId("studio-row").filter({ hasText: "Studio Mantido" });
    await row.getByRole("button", { name: /excluir studio mantido/i }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: /cancelar/i }).click();

    await expect(dialog).toBeHidden();
    await expect(
      page.getByTestId("studio-row").filter({ hasText: "Studio Mantido" }),
    ).toBeVisible();
  });

  test("the confirm button uses the destructive variant", async ({ page }) => {
    await seedStudio(page, "Visual Check", 50);
    await page.goto("/studios");

    const row = page.getByTestId("studio-row").filter({ hasText: "Visual Check" });
    await row.getByRole("button", { name: /excluir visual check/i }).click();

    const dialog = page.getByRole("alertdialog");
    const confirm = dialog.getByRole("button", { name: /^excluir$/i });
    await expect(confirm).toHaveClass(/bg-destructive/);
  });
});
