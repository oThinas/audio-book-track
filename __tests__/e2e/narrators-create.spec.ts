import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Narrators create", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/narrators");
  });

  test("happy path: create narrator appears as a row", async ({ page }) => {
    const stamp = Date.now();
    const email = `new-${stamp}@example.com`;

    await page.getByRole("button", { name: "Novo narrador", exact: true }).click();

    const newRow = page.getByTestId("narrator-new-row");
    await expect(newRow).toBeVisible();

    await newRow.getByLabel(/nome/i).fill("Narrador Criado");
    await newRow.getByLabel(/e-?mail/i).fill(email);
    await newRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(newRow).toBeHidden({ timeout: 10000 });
    await expect(page.getByTestId("narrator-row").filter({ hasText: email })).toBeVisible();
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
    await newRow.getByLabel(/e-?mail/i).fill("valid@example.com");
    await newRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(newRow.getByText(/mínimo 2 caracteres/i)).toBeVisible();
    await expect(newRow).toBeVisible();
  });

  test("shows inline validation when e-mail is invalid", async ({ page }) => {
    await page.getByRole("button", { name: "Novo narrador", exact: true }).click();
    const newRow = page.getByTestId("narrator-new-row");

    await newRow.getByLabel(/nome/i).fill("Nome Válido");
    await newRow.getByLabel(/e-?mail/i).fill("not-an-email");
    await newRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(newRow.getByText(/e-mail inválido/i)).toBeVisible();
    await expect(newRow).toBeVisible();
  });

  test("shows conflict error on duplicate e-mail", async ({ page }) => {
    const stamp = Date.now();
    const email = `dup-${stamp}@example.com`;

    const seed = await page.request.post("/api/v1/narrators", {
      data: { name: "Já cadastrado", email },
    });
    expect(seed.ok()).toBe(true);

    await page.goto("/narrators");
    await page.getByRole("button", { name: "Novo narrador", exact: true }).click();
    const newRow = page.getByTestId("narrator-new-row");

    await newRow.getByLabel(/nome/i).fill("Outro Nome");
    await newRow.getByLabel(/e-?mail/i).fill(email);
    await newRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(newRow.getByText(/e-mail já cadastrado/i)).toBeVisible();
    await expect(newRow).toBeVisible();
  });
});
