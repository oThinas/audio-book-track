import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

const FONT_SIZES = [
  { label: "Pequeno", cssValue: "14px" },
  { label: "Médio", cssValue: "16px" },
  { label: "Grande", cssValue: "18px" },
] as const;

async function seedNarrator(page: Page, name: string) {
  const response = await page.request.post("/api/v1/narrators", {
    data: { name },
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed narrator ${name}: ${response.status()}`);
  }
}

test.describe("Narrators: font size variants (SC-006)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const { label, cssValue } of FONT_SIZES) {
    test(`layout holds with font size ${label}`, async ({ page }) => {
      await seedNarrator(page, "Font Subject");

      await page.goto("/settings");
      await page.getByText(label, { exact: true }).click();
      const fontSize = await page.locator("html").evaluate((el) => el.style.fontSize);
      expect(fontSize).toBe(cssValue);

      await page.goto("/narrators");
      await expect(page.getByRole("heading", { name: /narradores/i })).toBeVisible();

      const scrollArea = page.getByTestId("narrators-scroll-area");
      await expect(scrollArea).toBeVisible();

      const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
      expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 1);

      const row = page.getByTestId("narrator-row").first();
      await row.getByRole("button", { name: /excluir font subject/i }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
    });
  }
});
