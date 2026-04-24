import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

const PRIMARY_COLORS = ["blue", "orange", "green", "red", "amber"] as const;

async function seedStudio(page: Page, name: string, defaultHourlyRateReais: number) {
  const response = await page.request.post("/api/v1/studios", {
    data: { name, defaultHourlyRateCents: Math.round(defaultHourlyRateReais * 100) },
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed studio ${name}: ${response.status()}`);
  }
}

async function applyPrimaryColor(page: Page, color: string) {
  await page.evaluate((c) => {
    document.documentElement.setAttribute("data-primary-color", c);
    localStorage.setItem("primary-color", c);
  }, color);
}

test.describe("Studios: primary colors", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const color of PRIMARY_COLORS) {
    test(`destructive stays visually distinct from primary for ${color}`, async ({ page }) => {
      await seedStudio(page, `Color ${color}`, 85);
      await page.goto("/studios");
      await applyPrimaryColor(page, color);

      const { primary, destructive } = await page.evaluate(() => {
        const styles = getComputedStyle(document.documentElement);
        return {
          primary: styles.getPropertyValue("--primary").trim(),
          destructive: styles.getPropertyValue("--destructive").trim(),
        };
      });

      expect(primary).not.toBe("");
      expect(destructive).not.toBe("");
      expect(destructive).not.toBe(primary);

      const row = page.getByTestId("studio-row").first();
      await expect(
        row.getByRole("button", { name: new RegExp(`excluir color ${color}`, "i") }),
      ).toBeVisible();
    });
  }
});
