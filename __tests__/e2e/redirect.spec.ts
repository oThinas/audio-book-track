import { expect, test } from "@playwright/test";

test.describe("Root Redirect (US5)", () => {
  test("should redirect unauthenticated user to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("should redirect authenticated user to favorite page", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.locator("#username").fill("admin");
    await page.locator("#password").fill("admin123");
    await page.locator("#login-submit").click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Visit root — should redirect to favorite page (default: dashboard)
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });
  });

  test("should redirect to updated favorite page after change", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.locator("#username").fill("admin");
    await page.locator("#password").fill("admin123");
    await page.locator("#login-submit").click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Change favorite page to books
    await page.goto("/settings");
    await page.getByTestId("favorite-page-select").click();
    await page.getByRole("option", { name: "Livros" }).click();
    await page.waitForTimeout(500);

    // Visit root — should redirect to /books
    await page.goto("/");
    await expect(page).toHaveURL(/\/books/, { timeout: 5000 });

    // Reset to dashboard for other tests
    await page.goto("/settings");
    await page.getByTestId("favorite-page-select").click();
    await page.getByRole("option", { name: "Dashboard" }).click();
    await page.waitForTimeout(500);
  });
});
