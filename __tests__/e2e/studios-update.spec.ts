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

const editingRowLocator = (page: Page) =>
  page.locator('[data-testid="studio-row"]:has(input[placeholder="Nome do estúdio"])');

test.describe("Studios update", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("edit mode populates inputs with current values", async ({ page }) => {
    await seedStudio(page, "Sonora Edit", 85);
    await page.goto("/studios");

    const row = page.getByTestId("studio-row").filter({ hasText: "Sonora Edit" });
    await row.getByRole("button", { name: /editar sonora edit/i }).click();

    const editing = editingRowLocator(page);
    await expect(editing.getByLabel(/^nome$/i)).toHaveValue("Sonora Edit");
    await expect(editing.getByLabel(/^valor\/hora$/i)).toHaveValue(/R\$\s*85,00/);
  });

  test("happy path: updating name and hourly rate persists", async ({ page }) => {
    await seedStudio(page, "Nome Antigo", 50);
    await page.goto("/studios");

    const row = page.getByTestId("studio-row").filter({ hasText: "Nome Antigo" });
    await row.getByRole("button", { name: /editar nome antigo/i }).click();

    const editing = editingRowLocator(page);
    await editing.getByLabel(/^nome$/i).fill("Nome Novo");
    const rateInput = editing.getByLabel(/^valor\/hora$/i);
    await rateInput.focus();
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Backspace");
    }
    await page.keyboard.type("12000");
    await editing.getByRole("button", { name: /confirmar/i }).click();

    const updated = page.getByTestId("studio-row").filter({ hasText: "Nome Novo" });
    await expect(updated).toBeVisible();
    await expect(updated.getByTestId("studio-hourly-rate")).toHaveText(/R\$\s*120,00/);
    await expect(page.getByTestId("studio-row").filter({ hasText: "Nome Antigo" })).toHaveCount(0);
  });

  test("cancel restores view mode without persisting", async ({ page }) => {
    await seedStudio(page, "Keep Me", 70);
    await page.goto("/studios");

    const row = page.getByTestId("studio-row").filter({ hasText: "Keep Me" });
    await row.getByRole("button", { name: /editar keep me/i }).click();

    const editing = editingRowLocator(page);
    await editing.getByLabel(/^nome$/i).fill("Typed But Cancelled");
    await editing.getByRole("button", { name: /cancelar/i }).click();

    const persisted = page.getByTestId("studio-row").filter({ hasText: "Keep Me" });
    await expect(persisted).toBeVisible();
    await expect(persisted.getByTestId("studio-hourly-rate")).toHaveText(/R\$\s*70,00/);
    await expect(
      page.getByTestId("studio-row").filter({ hasText: "Typed But Cancelled" }),
    ).toHaveCount(0);
  });

  test("inline validation when clearing the name", async ({ page }) => {
    await seedStudio(page, "Validate Name", 85);
    await page.goto("/studios");

    const row = page.getByTestId("studio-row").filter({ hasText: "Validate Name" });
    await row.getByRole("button", { name: /editar validate name/i }).click();

    const editing = editingRowLocator(page);
    await editing.getByLabel(/^nome$/i).fill("");
    await editing.getByRole("button", { name: /confirmar/i }).click();

    await expect(editing.getByText(/mínimo 2 caracteres/i)).toBeVisible();
  });

  test("inline validation when zeroing the hourly rate", async ({ page }) => {
    await seedStudio(page, "Zero Rate", 85);
    await page.goto("/studios");

    const row = page.getByTestId("studio-row").filter({ hasText: "Zero Rate" });
    await row.getByRole("button", { name: /editar zero rate/i }).click();

    const editing = editingRowLocator(page);
    const rateInput = editing.getByLabel(/^valor\/hora$/i);
    await rateInput.focus();
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Backspace");
    }
    await editing.getByRole("button", { name: /confirmar/i }).click();

    await expect(editing.getByText(/valor\/hora mínimo/i)).toBeVisible();
  });

  test("conflict error when renaming to another studio's name", async ({ page }) => {
    await seedStudio(page, "Alpha Studio", 50);
    await seedStudio(page, "Beta Studio", 60);
    await page.goto("/studios");

    const row = page.getByTestId("studio-row").filter({ hasText: "Beta Studio" });
    await row.getByRole("button", { name: /editar beta studio/i }).click();

    const editing = editingRowLocator(page);
    await editing.getByLabel(/^nome$/i).fill("Alpha Studio");
    await editing.getByRole("button", { name: /confirmar/i }).click();

    await expect(editing.getByText(/nome já cadastrado/i)).toBeVisible();
  });

  test("is idempotent when submitting the same values (no self-conflict)", async ({ page }) => {
    await seedStudio(page, "Idempotent", 85);
    await page.goto("/studios");

    const row = page.getByTestId("studio-row").filter({ hasText: "Idempotent" });
    await row.getByRole("button", { name: /editar idempotent/i }).click();

    const editing = editingRowLocator(page);
    await editing.getByRole("button", { name: /confirmar/i }).click();

    const persisted = page.getByTestId("studio-row").filter({ hasText: "Idempotent" });
    await expect(persisted).toBeVisible();
    await expect(persisted.getByTestId("studio-hourly-rate")).toHaveText(/R\$\s*85,00/);
  });

  test("two rows can be edited independently in parallel", async ({ page }) => {
    await seedStudio(page, "Parallel One", 50);
    await seedStudio(page, "Parallel Two", 60);
    await page.goto("/studios");

    const row1 = page.getByTestId("studio-row").filter({ hasText: "Parallel One" });
    const row2 = page.getByTestId("studio-row").filter({ hasText: "Parallel Two" });

    await row1.getByRole("button", { name: /editar parallel one/i }).click();
    await row2.getByRole("button", { name: /editar parallel two/i }).click();

    const editing = page.locator(
      '[data-testid="studio-row"]:has(input[placeholder="Nome do estúdio"])',
    );
    await expect(editing).toHaveCount(2);

    const firstEditing = editing.nth(0);
    const secondEditing = editing.nth(1);

    await firstEditing.getByLabel(/^nome$/i).fill("Parallel One Edited");
    await secondEditing.getByLabel(/^nome$/i).fill("Parallel Two Edited");

    await firstEditing.getByRole("button", { name: /confirmar/i }).click();
    await expect(
      page.getByTestId("studio-row").filter({ hasText: "Parallel One Edited" }),
    ).toBeVisible();
    await expect(editing).toHaveCount(1);

    await page
      .getByTestId("studio-row")
      .filter({ hasText: "Parallel Two Edited" })
      .getByRole("button", { name: /confirmar/i })
      .click();
    await expect(editing).toHaveCount(0);
    await expect(
      page.getByTestId("studio-row").filter({ hasText: "Parallel Two Edited" }),
    ).toBeVisible();
  });
});
