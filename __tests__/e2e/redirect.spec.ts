import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.locator("#username").fill("admin");
  await page.locator("#password").fill("admin123");
  await page.locator("#login-submit").click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
}

async function setFavoritePage(page: import("@playwright/test").Page, label: string) {
  await page.goto("/settings");
  await page.getByTestId("favorite-page-select").click();

  const responsePromise = page.waitForResponse(
    (r) => r.url().includes("/api/v1/user-preferences") && r.request().method() === "PATCH",
  );
  await page.getByRole("option", { name: label }).click();
  await responsePromise;
}

test.describe("Root Redirect (US5)", () => {
  test("should redirect unauthenticated user to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("should redirect to favorite page and update on change", async ({ page }) => {
    await login(page);

    // Set favorite to Estúdios (unique to avoid parallel test interference)
    await setFavoritePage(page, "Estúdios");

    await page.goto("/");
    await expect(page).toHaveURL(/\/studios/, { timeout: 5000 });

    // Change to Editores and verify redirect updates
    await setFavoritePage(page, "Editores");

    await page.goto("/");
    await expect(page).toHaveURL(/\/editors/, { timeout: 5000 });

    // Reset to dashboard
    await setFavoritePage(page, "Dashboard");
  });
});
