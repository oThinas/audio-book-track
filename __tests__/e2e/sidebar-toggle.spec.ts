import { expect, test } from "@playwright/test";

test.describe("Sidebar Toggle (US2)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.locator("#username").fill("admin");
    await page.locator("#password").fill("admin123");
    await page.locator("#login-submit").click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test("should show expanded sidebar by default on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const sidebar = page.getByTestId("sidebar");
    await expect(sidebar).toBeVisible();

    // Nav labels should be visible in expanded state
    await expect(sidebar.getByText("Dashboard")).toBeVisible();
  });

  test("should collapse sidebar when toggle is clicked", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const sidebar = page.getByTestId("sidebar");
    const toggle = page.getByTestId("sidebar-toggle");

    await toggle.click();

    // Labels should be hidden when collapsed
    await expect(sidebar.getByText("Dashboard")).toBeHidden();
  });

  test("should expand sidebar when toggle is clicked again", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const toggle = page.getByTestId("sidebar-toggle");
    const sidebar = page.getByTestId("sidebar");

    // Collapse
    await toggle.click();
    await expect(sidebar.getByText("Dashboard")).toBeHidden();

    // Expand
    await toggle.click();
    await expect(sidebar.getByText("Dashboard")).toBeVisible();
  });

  test("should persist collapsed state across navigation", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const toggle = page.getByTestId("sidebar-toggle");
    const sidebar = page.getByTestId("sidebar");

    // Collapse
    await toggle.click();
    await expect(sidebar.getByText("Dashboard")).toBeHidden();

    // Navigate and verify state persists
    await page.reload();
    await expect(sidebar.getByText("Dashboard")).toBeHidden();
  });
});
