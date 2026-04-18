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

test.describe("Narrators delete", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("happy path: confirming removes the row and the record", async ({ page }) => {
    await seedNarrator(page, "Target");
    await page.goto("/narrators");

    const row = page.getByTestId("narrator-row").first();
    await row.getByRole("button", { name: /excluir target/i }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/target/i);

    await dialog.getByRole("button", { name: /excluir/i }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("narrators-empty-state")).toBeVisible();
  });

  test("cancelling the modal keeps the row intact", async ({ page }) => {
    await seedNarrator(page, "Keep Me");
    await page.goto("/narrators");

    const row = page.getByTestId("narrator-row").first();
    await row.getByRole("button", { name: /excluir keep me/i }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: /cancelar/i }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("narrator-row")).toHaveCount(1);
    await expect(row.getByTestId("narrator-name")).toHaveText("Keep Me");
  });

  test("pressing Escape closes the modal without deleting", async ({ page }) => {
    await seedNarrator(page, "Escape Target");
    await page.goto("/narrators");

    const row = page.getByTestId("narrator-row").first();
    await row.getByRole("button", { name: /excluir escape target/i }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("narrator-row")).toHaveCount(1);
  });
});
