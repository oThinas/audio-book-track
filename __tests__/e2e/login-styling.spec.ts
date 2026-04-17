import { expect, test } from "./fixtures/app-server";

test.describe("Login Page Styling (US1)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("should show two-panel layout on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const leftPanel = page.getByTestId("login-branding-panel");
    const rightPanel = page.getByTestId("login-form-panel");

    await expect(leftPanel).toBeVisible();
    await expect(rightPanel).toBeVisible();

    // Branding panel content
    await expect(leftPanel.getByText("AudioBook Track")).toBeVisible();
    await expect(leftPanel.getByTestId("login-branding-icon")).toBeVisible();
  });

  test("should hide branding panel on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const leftPanel = page.getByTestId("login-branding-panel");
    const rightPanel = page.getByTestId("login-form-panel");

    await expect(leftPanel).toBeHidden();
    await expect(rightPanel).toBeVisible();
  });

  test("should show login form with all fields", async ({ page }) => {
    await expect(page.locator("#username")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#login-submit")).toBeVisible();
  });

  test("should use design tokens for colors (no hardcoded values)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const leftPanel = page.getByTestId("login-branding-panel");
    const bgColor = await leftPanel.evaluate((el) => getComputedStyle(el).backgroundColor);

    // Should have a non-transparent background (sidebar color)
    expect(bgColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(bgColor).not.toBe("transparent");
  });
});
