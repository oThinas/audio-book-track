import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

test.describe("Narrators create", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/narrators");
  });

  test("happy path: create narrator appears as a row", async ({ page }) => {
    const name = "Narrador Criado";

    await page.getByRole("button", { name: "Novo narrador", exact: true }).click();

    const newRow = page.getByTestId("narrator-new-row");
    await expect(newRow).toBeVisible();

    await newRow.getByLabel(/nome/i).fill(name);
    await expect(newRow.locator('input[type="email"]')).toHaveCount(0);
    await newRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(newRow).toBeHidden({ timeout: 10000 });
    await expect(page.getByTestId("narrator-row").filter({ hasText: name })).toBeVisible();
  });

  test("cancel discards the new row and keeps the table unchanged", async ({ page }) => {
    await page.getByRole("button", { name: "Novo narrador", exact: true }).click();

    const newRow = page.getByTestId("narrator-new-row");
    await expect(newRow).toBeVisible();

    await newRow.getByLabel(/nome/i).fill("Rascunho");
    await newRow.getByRole("button", { name: /cancelar/i }).click();

    await expect(newRow).toBeHidden();
    await expect(page.getByTestId("narrator-row").filter({ hasText: "Rascunho" })).toHaveCount(0);
  });

  test("shows inline validation when name is too short", async ({ page }) => {
    await page.getByRole("button", { name: "Novo narrador", exact: true }).click();
    const newRow = page.getByTestId("narrator-new-row");

    await newRow.getByLabel(/nome/i).fill("a");
    await newRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(newRow.getByText(/mínimo 2 caracteres/i)).toBeVisible();
    await expect(newRow).toBeVisible();
  });

  test("shows conflict error on duplicate name", async ({ page }) => {
    const name = "Duplicado";

    const seed = await page.request.post("/api/v1/narrators", {
      data: { name },
    });
    expect(seed.ok()).toBe(true);

    await page.goto("/narrators");
    await page.getByRole("button", { name: "Novo narrador", exact: true }).click();
    const newRow = page.getByTestId("narrator-new-row");

    await newRow.getByLabel(/nome/i).fill(name);
    await newRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(newRow.getByText(/nome já cadastrado/i)).toBeVisible();
    await expect(newRow).toBeVisible();
  });
});
