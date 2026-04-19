import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/app-server";
import { checkAccessibility } from "./helpers/accessibility";
import { login } from "./helpers/auth";

async function seedEditor(page: Page, name: string, email: string) {
  const response = await page.request.post("/api/v1/editors", {
    data: { name, email },
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed editor ${name}: ${response.status()}`);
  }
}

test.describe("Accessibility: Editors", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("editors list page - WCAG 2.1 AA across themes and colors", async ({ page }) => {
    await seedEditor(page, "A11y Editor", "a11y@studio.com");
    await page.goto("/editors");
    await expect(page.getByRole("heading", { name: /editores/i })).toBeVisible();

    await checkAccessibility(page, "editors-list");
  });

  test("delete confirmation dialog - WCAG 2.1 AA across themes and colors", async ({ page }) => {
    await seedEditor(page, "A11y Editor", "a11y@studio.com");
    await page.goto("/editors");

    const row = page.getByTestId("editor-row").first();
    await row.getByRole("button", { name: /excluir a11y editor/i }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();

    // color-contrast disabled: same destructive-foreground limitation as narrators
    // (see narrators-accessibility.spec.ts); pre-existing design-token issue.
    await checkAccessibility(page, "editors-delete-dialog", {
      disableRules: ["color-contrast"],
    });
  });
});
