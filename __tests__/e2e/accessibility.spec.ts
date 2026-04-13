import { expect, test } from "@playwright/test";
import { checkAccessibility } from "./helpers/accessibility";

test.describe("Accessibility: Login", () => {
  test("login - WCAG 2.1 AA", async ({ page }) => {
    await page.goto("/login");
    await checkAccessibility(page, "login", { authenticated: false });
  });
});

test.describe("Accessibility: Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.locator("#username").fill("admin");
    await page.locator("#password").fill("admin123");
    await page.locator("#login-submit").click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("dashboard - WCAG 2.1 AA", async ({ page }) => {
    await page.goto("/dashboard");
    await checkAccessibility(page, "dashboard");
  });
});

test.describe("Accessibility: Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.locator("#username").fill("admin");
    await page.locator("#password").fill("admin123");
    await page.locator("#login-submit").click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("settings - WCAG 2.1 AA", async ({ page }) => {
    await page.goto("/settings");
    await checkAccessibility(page, "settings");
  });
});
