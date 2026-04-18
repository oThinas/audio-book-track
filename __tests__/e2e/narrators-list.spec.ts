import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

async function seedNarrator(page: Page, name: string) {
  const response = await page.request.post("/api/v1/narrators", {
    data: { name },
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed narrator ${name}: ${response.status()}`);
  }
}

test.describe("Narrators list", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("empty state is shown when no narrators exist", async ({ page }) => {
    await page.goto("/narrators");

    await expect(page.getByRole("heading", { name: /narradores/i })).toBeVisible();
    await expect(page.getByTestId("narrators-empty-state")).toBeVisible();
  });

  test("page uses PageContainer layout and header", async ({ page }) => {
    await page.goto("/narrators");

    await expect(page.getByRole("heading", { name: /narradores/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Novo narrador", exact: true })).toBeVisible();
  });

  test("table is wrapped in a ScrollArea", async ({ page }) => {
    await seedNarrator(page, "Visible Narrator");
    await page.goto("/narrators");

    await expect(page.getByTestId("narrators-scroll-area")).toBeVisible();
  });

  test("only the Nome header is present (no E-mail column)", async ({ page }) => {
    await seedNarrator(page, "Visible Narrator");
    await page.goto("/narrators");

    const nameHeader = page.getByRole("button", { name: /^nome$/i });
    await expect(nameHeader).toBeVisible();

    await expect(page.getByRole("button", { name: /^e-mail$/i })).toHaveCount(0);
  });

  test("seeded narrators appear as rows and can be sorted by name", async ({ page }) => {
    await seedNarrator(page, "Carla Souza");
    await seedNarrator(page, "Bruno Lima");
    await seedNarrator(page, "Ana Prado");

    await page.goto("/narrators");

    const rows = page.getByTestId("narrator-row");
    await expect(rows).toHaveCount(3);

    const nameHeader = page.getByRole("button", { name: /^nome$/i });
    await nameHeader.click();

    const firstRowName = rows.first().getByTestId("narrator-name");
    await expect(firstRowName).toHaveText(/ana prado/i);

    await nameHeader.click();
    await expect(firstRowName).toHaveText(/carla souza/i);
  });
});
