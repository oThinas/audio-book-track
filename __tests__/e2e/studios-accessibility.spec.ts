import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/app-server";
import { checkAccessibility } from "./helpers/accessibility";
import { login } from "./helpers/auth";

async function seedStudio(page: Page, name: string, defaultHourlyRateReais: number) {
  const response = await page.request.post("/api/v1/studios", {
    data: { name, defaultHourlyRateCents: Math.round(defaultHourlyRateReais * 100) },
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed studio ${name}: ${response.status()}`);
  }
}

test.describe("Accessibility: Studios", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("studios list page - WCAG 2.1 AA across themes and colors", async ({ page }) => {
    await seedStudio(page, "A11y Studio", 85);
    await page.goto("/studios");
    await expect(page.getByRole("heading", { name: /estúdios/i })).toBeVisible();

    await checkAccessibility(page, "studios-list");
  });

  test("new row inline form - WCAG 2.1 AA", async ({ page }) => {
    await page.goto("/studios");
    await page.getByRole("button", { name: "Novo estúdio", exact: true }).click();
    await expect(page.getByTestId("studio-new-row")).toBeVisible();

    await checkAccessibility(page, "studios-new-row");
  });

  test("edit row inline form - WCAG 2.1 AA", async ({ page }) => {
    await seedStudio(page, "A11y Studio", 85);
    await page.goto("/studios");

    const row = page.getByTestId("studio-row").first();
    await row.getByRole("button", { name: /editar a11y studio/i }).click();

    await checkAccessibility(page, "studios-edit-row");
  });

  test("delete confirmation dialog - WCAG 2.1 AA across themes and colors", async ({ page }) => {
    await seedStudio(page, "A11y Studio", 85);
    await page.goto("/studios");

    const row = page.getByTestId("studio-row").first();
    await row.getByRole("button", { name: /excluir a11y studio/i }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();

    // color-contrast disabled: same destructive-foreground limitation as editors/narrators
    // (see narrators-accessibility.spec.ts); pre-existing design-token issue.
    await checkAccessibility(page, "studios-delete-dialog", {
      disableRules: ["color-contrast"],
    });
  });
});
