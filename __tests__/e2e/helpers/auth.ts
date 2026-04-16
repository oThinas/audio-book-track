import { expect, type Page } from "@playwright/test";

export async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#username").fill("admin");
  await page.locator("#password").fill("admin123");
  await page.locator("#login-submit").click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
}
