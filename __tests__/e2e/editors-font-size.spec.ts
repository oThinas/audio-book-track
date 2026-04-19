import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

const FONT_SIZES = [
  { label: "Pequeno", cssValue: "14px" },
  { label: "Médio", cssValue: "16px" },
  { label: "Grande", cssValue: "18px" },
] as const;

async function seedEditor(page: Page, name: string, email: string) {
  const response = await page.request.post("/api/v1/editors", {
    data: { name, email },
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed editor ${name}: ${response.status()}`);
  }
}

test.describe("Editors: font size variants (SC-006)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const { label, cssValue } of FONT_SIZES) {
    test(`layout holds with font size ${label}`, async ({ page }) => {
      await seedEditor(page, "Font Editor", "font@studio.com");

      await page.goto("/settings");
      await page.getByText(label, { exact: true }).click();
      const fontSize = await page.locator("html").evaluate((el) => el.style.fontSize);
      expect(fontSize).toBe(cssValue);

      await page.goto("/editors");
      await expect(page.getByRole("heading", { name: /editores/i })).toBeVisible();

      const scrollArea = page.getByTestId("editors-scroll-area");
      await expect(scrollArea).toBeVisible();

      const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
      expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 1);

      const row = page.getByTestId("editor-row").first();
      await row.getByRole("button", { name: /excluir font editor/i }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
    });
  }
});
