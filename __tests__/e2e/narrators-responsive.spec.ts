import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

const VIEWPORTS = [
  { label: "mobile", width: 375, height: 812 },
  { label: "tablet", width: 768, height: 1024 },
  { label: "desktop", width: 1440, height: 900 },
] as const;

async function seedNarrator(page: Page, name: string) {
  const response = await page.request.post("/api/v1/narrators", {
    data: { name },
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed narrator ${name}: ${response.status()}`);
  }
}

test.describe("Narrators: responsive layout", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const { label, width, height } of VIEWPORTS) {
    test(`renders without horizontal overflow at ${label} (${width}px)`, async ({ page }) => {
      await seedNarrator(page, "Responsive Subject");
      await page.setViewportSize({ width, height });
      await page.goto("/narrators");

      await expect(page.getByRole("heading", { name: /narradores/i })).toBeVisible();
      await expect(page.getByRole("button", { name: "Novo narrador", exact: true })).toBeVisible();
      await expect(page.getByTestId("narrators-scroll-area")).toBeVisible();

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });
  }
});
