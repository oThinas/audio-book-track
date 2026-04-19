import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

test.describe("Editors create", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/editors");
  });

  test("happy path: create editor appears as a row", async ({ page }) => {
    const name = "Editor Criado";
    const email = "criado@studio.com";

    await page.getByRole("button", { name: "Novo editor", exact: true }).click();

    const newRow = page.getByTestId("editor-new-row");
    await expect(newRow).toBeVisible();

    await newRow.getByLabel(/^nome$/i).fill(name);
    await newRow.getByLabel(/^e-mail$/i).fill(email);
    await newRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(newRow).toBeHidden({ timeout: 10000 });
    await expect(page.getByTestId("editor-row").filter({ hasText: name })).toBeVisible();
    await expect(page.getByTestId("editor-row").filter({ hasText: email })).toBeVisible();
  });

  test("cancel discards the new row and keeps the table unchanged", async ({ page }) => {
    await page.getByRole("button", { name: "Novo editor", exact: true }).click();

    const newRow = page.getByTestId("editor-new-row");
    await expect(newRow).toBeVisible();

    await newRow.getByLabel(/^nome$/i).fill("Rascunho");
    await newRow.getByLabel(/^e-mail$/i).fill("rascunho@x.com");
    await newRow.getByRole("button", { name: /cancelar/i }).click();

    await expect(newRow).toBeHidden();
    await expect(page.getByTestId("editor-row").filter({ hasText: "Rascunho" })).toHaveCount(0);
  });

  test("shows inline validation when name is too short", async ({ page }) => {
    await page.getByRole("button", { name: "Novo editor", exact: true }).click();
    const newRow = page.getByTestId("editor-new-row");

    await newRow.getByLabel(/^nome$/i).fill("a");
    await newRow.getByLabel(/^e-mail$/i).fill("valid@x.com");
    await newRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(newRow.getByText(/mínimo 2 caracteres/i)).toBeVisible();
    await expect(newRow).toBeVisible();
  });

  test("shows inline validation when email is malformed", async ({ page }) => {
    await page.getByRole("button", { name: "Novo editor", exact: true }).click();
    const newRow = page.getByTestId("editor-new-row");

    await newRow.getByLabel(/^nome$/i).fill("Carla");
    await newRow.getByLabel(/^e-mail$/i).fill("not-an-email");
    await newRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(newRow.getByText(/e-mail inválido/i)).toBeVisible();
    await expect(newRow).toBeVisible();
  });

  test("shows inline validation when email is empty", async ({ page }) => {
    await page.getByRole("button", { name: "Novo editor", exact: true }).click();
    const newRow = page.getByTestId("editor-new-row");

    await newRow.getByLabel(/^nome$/i).fill("Carla");
    await newRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(newRow.getByText(/e-mail é obrigatório/i)).toBeVisible();
    await expect(newRow).toBeVisible();
  });

  test("shows conflict error on duplicate name", async ({ page }) => {
    const name = "Nome Duplicado";

    const seed = await page.request.post("/api/v1/editors", {
      data: { name, email: "seed-dup-name@x.com" },
    });
    expect(seed.ok()).toBe(true);

    await page.goto("/editors");
    await page.getByRole("button", { name: "Novo editor", exact: true }).click();
    const newRow = page.getByTestId("editor-new-row");

    await newRow.getByLabel(/^nome$/i).fill(name);
    await newRow.getByLabel(/^e-mail$/i).fill("different@x.com");
    await newRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(newRow.getByText(/nome já cadastrado/i)).toBeVisible();
    await expect(newRow).toBeVisible();
  });

  test("shows conflict error on duplicate email (case-insensitive)", async ({ page }) => {
    const email = "dup-email@studio.com";

    const seed = await page.request.post("/api/v1/editors", {
      data: { name: "Seed Duplicado", email },
    });
    expect(seed.ok()).toBe(true);

    await page.goto("/editors");
    await page.getByRole("button", { name: "Novo editor", exact: true }).click();
    const newRow = page.getByTestId("editor-new-row");

    await newRow.getByLabel(/^nome$/i).fill("Outro Editor");
    await newRow.getByLabel(/^e-mail$/i).fill(email.toUpperCase());
    await newRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(newRow.getByText(/e-mail já cadastrado/i)).toBeVisible();
    await expect(newRow).toBeVisible();
  });
});
