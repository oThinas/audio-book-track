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

test.describe("Narrators update", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("happy path: editing name and email persists after reload", async ({ page }) => {
    await seedNarrator(page, "Original Name", "original@example.com");
    await page.goto("/narrators");

    const row = page.getByTestId("narrator-row").first();
    await row.getByRole("button", { name: /editar original name/i }).click();

    await row.getByLabel(/nome/i).fill("Updated Name");
    await row.getByLabel(/e-?mail/i).fill("updated@example.com");
    await row.getByRole("button", { name: /confirmar/i }).click();

    await expect(row.getByTestId("narrator-name")).toHaveText("Updated Name");
    await expect(row.getByTestId("narrator-email")).toHaveText("updated@example.com");

    await page.reload();
    const reloadedRow = page.getByTestId("narrator-row").first();
    await expect(reloadedRow.getByTestId("narrator-name")).toHaveText("Updated Name");
    await expect(reloadedRow.getByTestId("narrator-email")).toHaveText("updated@example.com");
  });

  test("cancel restores the original values", async ({ page }) => {
    await seedNarrator(page, "Keep Me", "keep@example.com");
    await page.goto("/narrators");

    const row = page.getByTestId("narrator-row").first();
    await row.getByRole("button", { name: /editar keep me/i }).click();

    await row.getByLabel(/nome/i).fill("Changed But Discarded");
    await row.getByRole("button", { name: /cancelar/i }).click();

    await expect(row.getByTestId("narrator-name")).toHaveText("Keep Me");
    await expect(row.getByTestId("narrator-email")).toHaveText("keep@example.com");
  });

  test("shows inline validation when name is too short", async ({ page }) => {
    await seedNarrator(page, "Valid Name", "valid@example.com");
    await page.goto("/narrators");

    const row = page.getByTestId("narrator-row").first();
    await row.getByRole("button", { name: /editar valid name/i }).click();

    await row.getByLabel(/nome/i).fill("a");
    await row.getByRole("button", { name: /confirmar/i }).click();

    await expect(row.getByText(/mínimo 2 caracteres/i)).toBeVisible();
    await expect(row.getByLabel(/nome/i)).toBeVisible();
  });

  test("shows conflict error on duplicate e-mail", async ({ page }) => {
    await seedNarrator(page, "First", "first@example.com");
    await seedNarrator(page, "Second", "second@example.com");
    await page.goto("/narrators");

    const firstRowInView = page.getByTestId("narrator-row").filter({ hasText: "First" });
    await firstRowInView.getByRole("button", { name: /editar first/i }).click();

    const editingRow = page.locator('[data-testid="narrator-row"]:has(input[type="email"])');
    await editingRow.getByLabel(/e-?mail/i).fill("second@example.com");
    await editingRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(editingRow.getByText(/e-mail já cadastrado/i)).toBeVisible();
    await expect(editingRow.getByLabel(/e-?mail/i)).toBeVisible();
  });
});
