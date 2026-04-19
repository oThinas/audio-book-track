import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

async function seedEditor(page: Page, name: string, email: string) {
  const response = await page.request.post("/api/v1/editors", {
    data: { name, email },
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed editor ${name}: ${response.status()}`);
  }
}

test.describe("Editors list", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("empty state is shown when no editors exist", async ({ page }) => {
    await page.goto("/editors");

    await expect(page.getByRole("heading", { name: /editores/i })).toBeVisible();
    await expect(page.getByTestId("editors-empty-state")).toBeVisible();
  });

  test("page uses PageContainer layout and header", async ({ page }) => {
    await page.goto("/editors");

    await expect(page.getByRole("heading", { name: /editores/i })).toBeVisible();
  });

  test("table is wrapped in a ScrollArea", async ({ page }) => {
    await seedEditor(page, "Visible Editor", "visible@studio.com");
    await page.goto("/editors");

    await expect(page.getByTestId("editors-scroll-area")).toBeVisible();
  });

  test("both Nome and E-mail headers are present", async ({ page }) => {
    await seedEditor(page, "Visible Editor", "visible@studio.com");
    await page.goto("/editors");

    await expect(page.getByRole("button", { name: /^nome$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^e-mail$/i })).toBeVisible();
  });

  test("seeded editors appear as rows and can be sorted by name", async ({ page }) => {
    await seedEditor(page, "Carla Souza", "carla@studio.com");
    await seedEditor(page, "Bruno Lima", "bruno@studio.com");
    await seedEditor(page, "Ana Prado", "ana@studio.com");

    await page.goto("/editors");

    const rows = page.getByTestId("editor-row");
    await expect(rows).toHaveCount(3);

    const nameHeader = page.getByRole("button", { name: /^nome$/i });
    await nameHeader.click();

    const firstRowName = rows.first().getByTestId("editor-name");
    await expect(firstRowName).toHaveText(/ana prado/i);

    await nameHeader.click();
    await expect(firstRowName).toHaveText(/carla souza/i);
  });

  test("seeded editors can be sorted by email", async ({ page }) => {
    await seedEditor(page, "Carla Souza", "c@studio.com");
    await seedEditor(page, "Bruno Lima", "b@studio.com");
    await seedEditor(page, "Ana Prado", "a@studio.com");

    await page.goto("/editors");

    const rows = page.getByTestId("editor-row");
    await expect(rows).toHaveCount(3);

    const emailHeader = page.getByRole("button", { name: /^e-mail$/i });
    await emailHeader.click();

    const firstRowEmail = rows.first().getByTestId("editor-email");
    await expect(firstRowEmail).toHaveText(/a@studio\.com/i);
  });
});
