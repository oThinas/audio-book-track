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

test.describe("Narrators update", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("happy path: editing name persists after reload", async ({ page }) => {
    await seedNarrator(page, "Original Name");
    await page.goto("/narrators");

    const row = page.getByTestId("narrator-row").first();
    await row.getByRole("button", { name: /editar original name/i }).click();

    await row.getByLabel(/nome/i).fill("Updated Name");
    await expect(row.locator('input[type="email"]')).toHaveCount(0);
    await row.getByRole("button", { name: /confirmar/i }).click();

    await expect(row.getByTestId("narrator-name")).toHaveText("Updated Name");

    await page.reload();
    const reloadedRow = page.getByTestId("narrator-row").first();
    await expect(reloadedRow.getByTestId("narrator-name")).toHaveText("Updated Name");
  });

  test("cancel restores the original name", async ({ page }) => {
    await seedNarrator(page, "Keep Me");
    await page.goto("/narrators");

    const row = page.getByTestId("narrator-row").first();
    await row.getByRole("button", { name: /editar keep me/i }).click();

    await row.getByLabel(/nome/i).fill("Changed But Discarded");
    await row.getByRole("button", { name: /cancelar/i }).click();

    await expect(row.getByTestId("narrator-name")).toHaveText("Keep Me");
  });

  test("shows inline validation when name is too short", async ({ page }) => {
    await seedNarrator(page, "Valid Name");
    await page.goto("/narrators");

    const row = page.getByTestId("narrator-row").first();
    await row.getByRole("button", { name: /editar valid name/i }).click();

    await row.getByLabel(/nome/i).fill("a");
    await row.getByRole("button", { name: /confirmar/i }).click();

    await expect(row.getByText(/mínimo 2 caracteres/i)).toBeVisible();
    await expect(row.getByLabel(/nome/i)).toBeVisible();
  });

  test("shows conflict error when renaming to another narrator's name", async ({ page }) => {
    await seedNarrator(page, "First");
    await seedNarrator(page, "Second");
    await page.goto("/narrators");

    const firstRowInView = page.getByTestId("narrator-row").filter({ hasText: "First" });
    await firstRowInView.getByRole("button", { name: /editar first/i }).click();

    const editingRow = page.locator(
      '[data-testid="narrator-row"]:has(input[placeholder="Nome do narrador"])',
    );
    await editingRow.getByLabel(/nome/i).fill("Second");
    await editingRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(editingRow.getByText(/nome já cadastrado/i)).toBeVisible();
    await expect(editingRow.getByLabel(/nome/i)).toBeVisible();
  });

  test("keeping the same name on edit succeeds (idempotent)", async ({ page }) => {
    await seedNarrator(page, "Mesmo Nome");
    await page.goto("/narrators");

    const row = page.getByTestId("narrator-row").first();
    await row.getByRole("button", { name: /editar mesmo nome/i }).click();

    await row.getByRole("button", { name: /confirmar/i }).click();

    await expect(row.getByTestId("narrator-name")).toHaveText("Mesmo Nome");
  });
});
