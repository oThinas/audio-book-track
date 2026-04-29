import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

test.describe("Studios create", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/studios");
  });

  test("happy path: cents-first input creates studio and row persists", async ({ page }) => {
    const name = "Studio Criado";

    await page.getByRole("button", { name: "Novo estúdio", exact: true }).click();

    const newRow = page.getByTestId("studio-new-row");
    await expect(newRow).toBeVisible();

    await newRow.getByLabel(/^nome$/i).fill(name);
    const rateInput = newRow.getByLabel(/^valor\/hora$/i);
    await rateInput.focus();
    await page.keyboard.type("8500");
    await expect(rateInput).toHaveValue(/R\$\s*85,00/);

    await newRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(newRow).toBeHidden({ timeout: 10000 });
    const createdRow = page.getByTestId("studio-row").filter({ hasText: name });
    await expect(createdRow).toBeVisible();
    await expect(createdRow.getByTestId("studio-hourly-rate")).toHaveText(/R\$\s*85,00/);
  });

  test("cancel discards the new row without persisting", async ({ page }) => {
    await page.getByRole("button", { name: "Novo estúdio", exact: true }).click();

    const newRow = page.getByTestId("studio-new-row");
    await expect(newRow).toBeVisible();

    await newRow.getByLabel(/^nome$/i).fill("Rascunho");
    await newRow.getByLabel(/^valor\/hora$/i).focus();
    await page.keyboard.type("5000");
    await newRow.getByRole("button", { name: /cancelar/i }).click();

    await expect(newRow).toBeHidden();
    await expect(page.getByTestId("studio-row").filter({ hasText: "Rascunho" })).toHaveCount(0);
  });

  test("inline validation when name is empty", async ({ page }) => {
    await page.getByRole("button", { name: "Novo estúdio", exact: true }).click();
    const newRow = page.getByTestId("studio-new-row");

    await newRow.getByLabel(/^valor\/hora$/i).focus();
    await page.keyboard.type("5000");
    await newRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(newRow.getByText(/mínimo 2 caracteres/i)).toBeVisible();
    await expect(newRow).toBeVisible();
  });

  test("inline validation when hourly rate is R$ 0,00", async ({ page }) => {
    await page.getByRole("button", { name: "Novo estúdio", exact: true }).click();
    const newRow = page.getByTestId("studio-new-row");

    await newRow.getByLabel(/^nome$/i).fill("Algum Estúdio");
    await newRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(newRow.getByText(/valor\/hora mínimo/i)).toBeVisible();
    await expect(newRow).toBeVisible();
  });

  test("conflict on duplicate name shows inline error", async ({ page }) => {
    const name = "Sonora Duplicada";

    const seed = await page.request.post("/api/v1/studios", {
      data: { name, defaultHourlyRateCents: 7000 },
    });
    expect(seed.ok()).toBe(true);

    await page.goto("/studios");
    await page.getByRole("button", { name: "Novo estúdio", exact: true }).click();
    const newRow = page.getByTestId("studio-new-row");

    await newRow.getByLabel(/^nome$/i).fill(name);
    await newRow.getByLabel(/^valor\/hora$/i).focus();
    await page.keyboard.type("9000");
    await newRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(newRow.getByText(/nome já cadastrado/i)).toBeVisible();
    await expect(newRow).toBeVisible();
  });

  test("clicking '+ Novo Estúdio' while a new row is open focuses the name input", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Novo estúdio", exact: true }).click();
    const newRow = page.getByTestId("studio-new-row");
    await expect(newRow).toBeVisible();
    await expect(page.getByTestId("studio-new-row")).toHaveCount(1);

    await page.getByRole("button", { name: "Novo estúdio", exact: true }).click();
    await expect(page.getByTestId("studio-new-row")).toHaveCount(1);
    const nameInput = newRow.getByLabel(/^nome$/i);
    await expect(nameInput).toBeFocused();
  });

  test("created studio appears at the top (DESC ordering preserved)", async ({ page }) => {
    const seed = await page.request.post("/api/v1/studios", {
      data: { name: "Primeiro Estúdio", defaultHourlyRateCents: 6000 },
    });
    expect(seed.ok()).toBe(true);

    await page.goto("/studios");

    await page.getByRole("button", { name: "Novo estúdio", exact: true }).click();
    const newRow = page.getByTestId("studio-new-row");
    await newRow.getByLabel(/^nome$/i).fill("Segundo Estúdio");
    await newRow.getByLabel(/^valor\/hora$/i).focus();
    await page.keyboard.type("7500");
    await newRow.getByRole("button", { name: /confirmar/i }).click();

    await expect(newRow).toBeHidden({ timeout: 10000 });
    const rows = page.getByTestId("studio-row");
    await expect(rows.first().getByTestId("studio-name")).toHaveText(/segundo estúdio/i);
    await expect(rows.last().getByTestId("studio-name")).toHaveText(/primeiro estúdio/i);
  });
});
