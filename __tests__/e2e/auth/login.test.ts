import { expect, test } from "@playwright/test";

test.describe("Login Flow (US2)", () => {
  test("should redirect unauthenticated user from /dashboard to /login", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login/);
  });

  test("should login with valid credentials and redirect away from /login", async ({ page }) => {
    await page.goto("/login");

    await page.locator("#username").fill("admin");
    await page.locator("#password").fill("admin123");
    await page.locator("#login-submit").click();

    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("should show error toast on invalid credentials and stay on /login", async ({ page }) => {
    await page.goto("/login");

    await page.locator("#username").fill("admin");
    await page.locator("#password").fill("wrongpassword");
    await page.locator("#login-submit").click();

    const toast = page.locator("[data-sonner-toast]");
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText("Credenciais inválidas");

    await expect(page).toHaveURL(/\/login/);
  });
});
