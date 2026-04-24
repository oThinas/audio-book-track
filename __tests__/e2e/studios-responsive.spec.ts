import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

const VIEWPORTS = [
  { label: "mobile", width: 375, height: 812 },
  { label: "tablet", width: 768, height: 1024 },
  { label: "desktop", width: 1440, height: 900 },
] as const;

async function seedStudio(page: Page, name: string, defaultHourlyRateReais: number) {
  const response = await page.request.post("/api/v1/studios", {
    data: { name, defaultHourlyRateCents: Math.round(defaultHourlyRateReais * 100) },
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed studio ${name}: ${response.status()}`);
  }
}

test.describe("Studios: responsive layout", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const { label, width, height } of VIEWPORTS) {
    test(`renders without horizontal overflow at ${label} (${width}px)`, async ({ page }) => {
      await seedStudio(page, "Responsive Studio", 85);
      await page.setViewportSize({ width, height });
      await page.goto("/studios");

      await expect(page.getByRole("heading", { name: /estúdios/i })).toBeVisible();
      await expect(page.getByRole("button", { name: "Novo estúdio", exact: true })).toBeVisible();
      await expect(page.getByTestId("studios-scroll-area")).toBeVisible();

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });
  }

  test("MoneyInput is usable on mobile (inputMode=numeric)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/studios");

    await page.getByRole("button", { name: "Novo estúdio", exact: true }).click();
    const rateInput = page.getByTestId("studio-new-row").getByLabel(/^valor\/hora$/i);
    await expect(rateInput).toHaveAttribute("inputmode", "numeric");
  });
});
