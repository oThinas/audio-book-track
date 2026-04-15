import { expect, test } from "@playwright/test";

test.describe("Mobile Sidebar Menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/login");
    await page.locator("#username").fill("admin");
    await page.locator("#password").fill("admin123");
    await page.locator("#login-submit").click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("mobile-header")).toBeVisible();
  });

  test("should hide desktop sidebar on mobile viewport", async ({ page }) => {
    const sidebar = page.getByTestId("sidebar");
    await expect(sidebar).toBeHidden();
  });

  test("should show mobile header with menu button", async ({ page }) => {
    const header = page.getByTestId("mobile-header");
    await expect(header).toBeVisible();

    const menuButton = header.getByRole("button", { name: /menu/i });
    await expect(menuButton).toBeVisible();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  test("should open mobile sidebar when menu button is clicked", async ({ page }) => {
    const menuButton = page.getByTestId("mobile-header").getByRole("button", { name: /menu/i });
    await menuButton.click();

    const mobileSidebar = page.getByTestId("mobile-sidebar");
    await expect(mobileSidebar).toBeVisible();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  });

  test("should close mobile sidebar when menu button is clicked again", async ({ page }) => {
    const menuButton = page.getByTestId("mobile-header").getByRole("button", { name: /menu/i });

    await menuButton.click();
    await expect(page.getByTestId("mobile-sidebar")).toHaveClass(/translate-x-0/);

    await menuButton.click();
    await expect(page.getByTestId("mobile-sidebar")).toHaveClass(/-translate-x-full/);
  });

  test("should render all navigation items in mobile sidebar", async ({ page }) => {
    const menuButton = page.getByTestId("mobile-header").getByRole("button", { name: /menu/i });
    await menuButton.click();

    const mobileSidebar = page.getByTestId("mobile-sidebar");
    await expect(mobileSidebar.getByText("Dashboard")).toBeVisible();
    await expect(mobileSidebar.getByText("Livros")).toBeVisible();
    await expect(mobileSidebar.getByText("Estúdios")).toBeVisible();
    await expect(mobileSidebar.getByText("Editores")).toBeVisible();
    await expect(mobileSidebar.getByText("Gravadores")).toBeVisible();
    await expect(mobileSidebar.getByText("Configurações")).toBeVisible();
    await expect(mobileSidebar.getByText("Sair")).toBeVisible();
  });

  test("should navigate and close menu when nav item is clicked", async ({ page }) => {
    const menuButton = page.getByTestId("mobile-header").getByRole("button", { name: /menu/i });
    await menuButton.click();

    const mobileSidebar = page.getByTestId("mobile-sidebar");
    await mobileSidebar.getByText("Configurações").click();

    await expect(page).toHaveURL(/\/settings/, { timeout: 10000 });
    await expect(page.getByTestId("mobile-header")).toBeVisible();
    await expect(page.getByTestId("mobile-sidebar")).toHaveClass(/-translate-x-full/);
  });

  test("should close menu when Escape key is pressed", async ({ page }) => {
    const menuButton = page.getByTestId("mobile-header").getByRole("button", { name: /menu/i });
    await menuButton.click();

    await expect(page.getByTestId("mobile-sidebar")).toHaveClass(/translate-x-0/);

    await page.keyboard.press("Escape");

    await expect(page.getByTestId("mobile-sidebar")).toHaveClass(/-translate-x-full/);
  });

  test("should have hamburger icon with animated spans", async ({ page }) => {
    const menuButton = page.getByTestId("mobile-header").getByRole("button", { name: /menu/i });
    const spans = menuButton.locator("span");

    await expect(spans).toHaveCount(3);

    await menuButton.click();

    await expect(spans).toHaveCount(3);
  });
});
