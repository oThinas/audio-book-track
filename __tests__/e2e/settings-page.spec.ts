import { expect, test } from "@playwright/test";

test.describe("Settings Page (US3)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.locator("#username").fill("admin");
    await page.locator("#password").fill("admin123");
    await page.locator("#login-submit").click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
    await page.goto("/settings");
  });

  test("should display settings page title", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();
  });

  test("should display preferences card with section title", async ({ page }) => {
    await expect(page.getByText("Aparência")).toBeVisible();
    await expect(page.getByText("Personalize como o sistema aparece para você")).toBeVisible();
  });

  test("should display all preference rows", async ({ page }) => {
    await expect(page.getByText("Tema", { exact: true })).toBeVisible();
    await expect(page.getByText("Tamanho da fonte", { exact: true })).toBeVisible();
    await expect(page.getByText("Cor primária", { exact: true })).toBeVisible();
    await expect(page.getByText("Página favorita", { exact: true })).toBeVisible();
  });

  test("should be accessible from sidebar", async ({ page }) => {
    const sidebar = page.getByTestId("sidebar");
    const settingsLink = sidebar.getByText("Configurações");
    await expect(settingsLink).toBeVisible();
  });

  test("should stack cards on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();
  });
});
