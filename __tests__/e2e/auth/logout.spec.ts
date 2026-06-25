import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/app-server";
import { login } from "../helpers/auth";

// Uses /login?reauth=1 directly because authClient.signOut() fails in the E2E
// environment (port 3100 vs BETTER_AUTH_URL on port 3000 = origin mismatch).
// The middleware clears the session cookies and renders /login (no GET side effect).
async function logout(page: Page) {
  await page.goto("/login?reauth=1");
  await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
}

test.describe("Logout Flow (US3)", () => {
  test("should redirect to /login after clicking logout", async ({ page }) => {
    await login(page);

    await logout(page);

    await expect(page).toHaveURL(/\/login/);
  });

  test("should not allow access to /dashboard after logout", async ({ page }) => {
    await login(page);
    await logout(page);

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("should show functional login form after logout", async ({ page }) => {
    await login(page);
    await logout(page);

    await expect(page.locator("#username")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#login-submit")).toBeVisible();
  });
});
