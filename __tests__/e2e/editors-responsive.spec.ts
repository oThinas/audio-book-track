import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

const VIEWPORTS = [
  { label: "mobile", width: 375, height: 812 },
  { label: "tablet", width: 768, height: 1024 },
  { label: "desktop", width: 1440, height: 900 },
] as const;

async function seedEditor(page: Page, name: string, email: string) {
  const response = await page.request.post("/api/v1/editors", {
    data: { name, email },
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed editor ${name}: ${response.status()}`);
  }
}

test.describe("Editors: responsive layout", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const { label, width, height } of VIEWPORTS) {
    test(`renders without horizontal overflow at ${label} (${width}px)`, async ({ page }) => {
      await seedEditor(page, "Responsive Editor", "responsive@studio.com");
      await page.setViewportSize({ width, height });
      await page.goto("/editors");

      await expect(page.getByRole("heading", { name: /editores/i })).toBeVisible();
      await expect(page.getByRole("button", { name: "Novo editor", exact: true })).toBeVisible();
      await expect(page.getByTestId("editors-scroll-area")).toBeVisible();

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });
  }
});
