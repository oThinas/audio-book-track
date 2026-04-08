import { expect, test } from "@playwright/test";

test.describe("Settings Preferences (US4)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.locator("#username").fill("admin");
    await page.locator("#password").fill("admin123");
    await page.locator("#login-submit").click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
    await page.goto("/settings");
  });

  test.describe("Theme Selector", () => {
    test("should display theme options (Claro, Escuro, Sistema)", async ({ page }) => {
      await expect(page.getByText("Claro", { exact: true })).toBeVisible();
      await expect(page.getByText("Escuro", { exact: true })).toBeVisible();
      await expect(page.getByText("Sistema", { exact: true })).toBeVisible();
    });

    test("should apply dark theme when Escuro is selected", async ({ page }) => {
      await page.getByText("Escuro", { exact: true }).click();
      await expect(page.locator("html")).toHaveClass(/dark/);
    });

    test("should apply light theme when Claro is selected", async ({ page }) => {
      await page.getByText("Claro", { exact: true }).click();
      await expect(page.locator("html")).not.toHaveClass(/dark/);
    });
  });

  test.describe("Font Size Selector", () => {
    test("should display font size options (Pequeno, Médio, Grande)", async ({ page }) => {
      await expect(page.getByText("Pequeno", { exact: true })).toBeVisible();
      await expect(page.getByText("Médio", { exact: true })).toBeVisible();
      await expect(page.getByText("Grande", { exact: true })).toBeVisible();
    });

    test("should change html font-size when option is selected", async ({ page }) => {
      await page.getByText("Grande", { exact: true }).click();
      const fontSize = await page.locator("html").evaluate((el) => el.style.fontSize);
      expect(fontSize).toBe("18px");
    });
  });

  test.describe("Primary Color Selector", () => {
    test("should display color swatches", async ({ page }) => {
      await expect(page.getByTestId("color-swatch-blue")).toBeVisible();
      await expect(page.getByTestId("color-swatch-orange")).toBeVisible();
      await expect(page.getByTestId("color-swatch-green")).toBeVisible();
      await expect(page.getByTestId("color-swatch-red")).toBeVisible();
      await expect(page.getByTestId("color-swatch-amber")).toBeVisible();
    });

    test("should change primary color when swatch is clicked", async ({ page }) => {
      await page.getByTestId("color-swatch-green").click();
      const attr = await page.locator("html").getAttribute("data-primary-color");
      expect(attr).toBe("green");
    });
  });

  test.describe("Favorite Page Selector", () => {
    test("should display favorite page select dropdown", async ({ page }) => {
      await expect(page.getByTestId("favorite-page-select")).toBeVisible();
    });

    test("should change favorite page and auto-save", async ({ page }) => {
      await page.getByTestId("favorite-page-select").click();

      const savePromise = page.waitForResponse(
        (r) => r.url().includes("/api/v1/user-preferences") && r.request().method() === "PATCH",
      );
      await page.getByRole("option", { name: "Livros" }).click();
      await savePromise;

      await page.reload();
      await expect(page.getByTestId("favorite-page-select")).toContainText(/livros|books/i);

      // Reset for other tests
      await page.getByTestId("favorite-page-select").click();
      const resetPromise = page.waitForResponse(
        (r) => r.url().includes("/api/v1/user-preferences") && r.request().method() === "PATCH",
      );
      await page.getByRole("option", { name: "Dashboard" }).click();
      await resetPromise;
    });
  });

  test.describe("Auto-save", () => {
    test("should persist theme preference after page reload", async ({ page }) => {
      await page.getByText("Escuro", { exact: true }).click();
      await page.waitForTimeout(500);
      await page.reload();
      await expect(page.locator("html")).toHaveClass(/dark/);
    });
  });
});
