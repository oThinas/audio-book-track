import { expect, test } from "./fixtures/app-server";

test.describe("Sidebar Toggle (US2)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/login");
    await page.locator("#username").fill("admin");
    await page.locator("#password").fill("admin123");
    await page.locator("#login-submit").click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("sidebar")).toBeVisible();
  });

  test("should show expanded sidebar by default on desktop", async ({ page }) => {
    const sidebar = page.getByTestId("sidebar");
    await expect(sidebar.getByText("Dashboard")).toBeVisible();
  });

  test("should collapse sidebar when toggle is clicked", async ({ page }) => {
    const sidebar = page.getByTestId("sidebar");
    const toggle = page.getByTestId("sidebar-toggle");

    await expect(toggle).toBeVisible();
    await toggle.click();

    await expect(sidebar.getByText("Dashboard")).toBeHidden();
  });

  test("should expand sidebar when toggle is clicked again", async ({ page }) => {
    const toggle = page.getByTestId("sidebar-toggle");
    const sidebar = page.getByTestId("sidebar");

    await toggle.click();
    await expect(sidebar.getByText("Dashboard")).toBeHidden();

    await toggle.click();
    await expect(sidebar.getByText("Dashboard")).toBeVisible();
  });

  test("should persist collapsed state across navigation", async ({ page }) => {
    const toggle = page.getByTestId("sidebar-toggle");
    const sidebar = page.getByTestId("sidebar");

    await toggle.click();
    await expect(sidebar.getByText("Dashboard")).toBeHidden();

    await page.reload();
    await expect(page.getByTestId("sidebar")).toBeVisible();
    await expect(page.getByTestId("sidebar").getByText("Dashboard")).toBeHidden();
  });
});
