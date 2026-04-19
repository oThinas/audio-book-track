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

const editingRowLocator = (page: Page) =>
  page.locator('[data-testid="editor-row"]:has(input[placeholder="Nome do editor"])');

test.describe("Editors update", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("edit mode populates inputs with current values", async ({ page }) => {
    await seedEditor(page, "Carla Edit", "carla-edit@studio.com");
    await page.goto("/editors");

    const row = page.getByTestId("editor-row").filter({ hasText: "Carla Edit" });
    await row.getByRole("button", { name: /editar carla edit/i }).click();

    const editing = editingRowLocator(page);
    await expect(editing.getByLabel(/^nome$/i)).toHaveValue("Carla Edit");
    await expect(editing.getByLabel(/^e-mail$/i)).toHaveValue("carla-edit@studio.com");
  });

  test("happy path: updating the name persists and returns to view mode", async ({ page }) => {
    await seedEditor(page, "Nome Antigo", "nome-antigo@studio.com");
    await page.goto("/editors");

    const row = page.getByTestId("editor-row").filter({ hasText: "Nome Antigo" });
    await row.getByRole("button", { name: /editar nome antigo/i }).click();

    const editing = editingRowLocator(page);
    await editing.getByLabel(/^nome$/i).fill("Nome Novo");
    await editing.getByRole("button", { name: /confirmar/i }).click();

    await expect(page.getByTestId("editor-row").filter({ hasText: "Nome Novo" })).toBeVisible();
    await expect(page.getByTestId("editor-row").filter({ hasText: "Nome Antigo" })).toHaveCount(0);
  });

  test("updating only the email persists", async ({ page }) => {
    await seedEditor(page, "Email Solo", "email-antigo@studio.com");
    await page.goto("/editors");

    const row = page.getByTestId("editor-row").filter({ hasText: "Email Solo" });
    await row.getByRole("button", { name: /editar email solo/i }).click();

    const editing = editingRowLocator(page);
    await editing.getByLabel(/^e-mail$/i).fill("email-novo@studio.com");
    await editing.getByRole("button", { name: /confirmar/i }).click();

    await expect(
      page.getByTestId("editor-row").filter({ hasText: "email-novo@studio.com" }),
    ).toBeVisible();
  });

  test("cancel restores view mode without persisting", async ({ page }) => {
    await seedEditor(page, "Keep Me", "keep-me@studio.com");
    await page.goto("/editors");

    const row = page.getByTestId("editor-row").filter({ hasText: "Keep Me" });
    await row.getByRole("button", { name: /editar keep me/i }).click();

    const editing = editingRowLocator(page);
    await editing.getByLabel(/^nome$/i).fill("Typed But Cancelled");
    await editing.getByRole("button", { name: /cancelar/i }).click();

    await expect(page.getByTestId("editor-row").filter({ hasText: "Keep Me" })).toBeVisible();
    await expect(
      page.getByTestId("editor-row").filter({ hasText: "Typed But Cancelled" }),
    ).toHaveCount(0);
  });

  test("shows inline validation when clearing the name", async ({ page }) => {
    await seedEditor(page, "Validate Name", "validate-name@studio.com");
    await page.goto("/editors");

    const row = page.getByTestId("editor-row").filter({ hasText: "Validate Name" });
    await row.getByRole("button", { name: /editar validate name/i }).click();

    const editing = editingRowLocator(page);
    await editing.getByLabel(/^nome$/i).fill("");
    await editing.getByRole("button", { name: /confirmar/i }).click();

    await expect(editing.getByText(/mínimo 2 caracteres/i)).toBeVisible();
  });

  test("shows inline validation when email becomes invalid", async ({ page }) => {
    await seedEditor(page, "Validate Email", "validate-email@studio.com");
    await page.goto("/editors");

    const row = page.getByTestId("editor-row").filter({ hasText: "Validate Email" });
    await row.getByRole("button", { name: /editar validate email/i }).click();

    const editing = editingRowLocator(page);
    await editing.getByLabel(/^e-mail$/i).fill("not-an-email");
    await editing.getByRole("button", { name: /confirmar/i }).click();

    await expect(editing.getByText(/e-mail inválido/i)).toBeVisible();
  });

  test("shows conflict error when renaming to another editor's name", async ({ page }) => {
    await seedEditor(page, "Alpha Name", "alpha@studio.com");
    await seedEditor(page, "Beta Name", "beta@studio.com");
    await page.goto("/editors");

    const row = page.getByTestId("editor-row").filter({ hasText: "Beta Name" });
    await row.getByRole("button", { name: /editar beta name/i }).click();

    const editing = editingRowLocator(page);
    await editing.getByLabel(/^nome$/i).fill("Alpha Name");
    await editing.getByRole("button", { name: /confirmar/i }).click();

    await expect(editing.getByText(/nome já cadastrado/i)).toBeVisible();
  });

  test("shows conflict error when email collides (case-insensitive)", async ({ page }) => {
    await seedEditor(page, "Gamma", "gamma-conflict@studio.com");
    await seedEditor(page, "Delta", "delta@studio.com");
    await page.goto("/editors");

    const row = page.getByTestId("editor-row").filter({ hasText: "Delta" });
    await row.getByRole("button", { name: /editar delta/i }).click();

    const editing = editingRowLocator(page);
    await editing.getByLabel(/^e-mail$/i).fill("GAMMA-CONFLICT@STUDIO.COM");
    await editing.getByRole("button", { name: /confirmar/i }).click();

    await expect(editing.getByText(/e-mail já cadastrado/i)).toBeVisible();
  });

  test("is idempotent when submitting the same values", async ({ page }) => {
    await seedEditor(page, "Idempotent", "idempotent@studio.com");
    await page.goto("/editors");

    const row = page.getByTestId("editor-row").filter({ hasText: "Idempotent" });
    await row.getByRole("button", { name: /editar idempotent/i }).click();

    const editing = editingRowLocator(page);
    await editing.getByRole("button", { name: /confirmar/i }).click();

    await expect(
      page.getByTestId("editor-row").filter({ hasText: "idempotent@studio.com" }),
    ).toBeVisible();
  });
});
