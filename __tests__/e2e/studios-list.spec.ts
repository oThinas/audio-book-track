import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

// TODO(US2/T027): remover o `test.skip` dos casos que dependem de `seedStudio`
// assim que o endpoint `POST /api/v1/studios` existir. Por enquanto, esses
// casos esperam pela implementação de criação na próxima fase.
async function seedStudio(page: Page, name: string, defaultHourlyRate: number) {
  const response = await page.request.post("/api/v1/studios", {
    data: { name, defaultHourlyRate },
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed studio ${name}: ${response.status()}`);
  }
}

test.describe("Studios list", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("empty state is shown when no studios exist", async ({ page }) => {
    await page.goto("/studios");

    await expect(page.getByRole("heading", { name: /estúdios/i })).toBeVisible();
    await expect(page.getByTestId("studios-empty-state")).toBeVisible();
  });

  test("page uses PageContainer layout and header", async ({ page }) => {
    await page.goto("/studios");

    await expect(page.getByRole("heading", { name: /estúdios/i })).toBeVisible();
  });

  test.skip("table is wrapped in a ScrollArea", async ({ page }) => {
    await seedStudio(page, "Visible Studio", 85);
    await page.goto("/studios");

    await expect(page.getByTestId("studios-scroll-area")).toBeVisible();
  });

  test.skip("both Nome and Valor/hora headers are present", async ({ page }) => {
    await seedStudio(page, "Visible Studio", 85);
    await page.goto("/studios");

    await expect(page.getByRole("button", { name: /^nome$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^valor\/hora$/i })).toBeVisible();
  });

  test.skip("defaultHourlyRate is displayed formatted as BRL", async ({ page }) => {
    await seedStudio(page, "Sonora", 85);
    await seedStudio(page, "Voz & Arte", 90.5);
    await page.goto("/studios");

    await expect(
      page.getByTestId("studio-hourly-rate").filter({ hasText: "R$ 85,00" }),
    ).toBeVisible();
    await expect(
      page.getByTestId("studio-hourly-rate").filter({ hasText: "R$ 90,50" }),
    ).toBeVisible();
  });

  test.skip("seeded studios appear in created_at DESC order (most recent first)", async ({
    page,
  }) => {
    await seedStudio(page, "Primeiro", 50);
    await seedStudio(page, "Segundo", 60);
    await seedStudio(page, "Terceiro", 70);

    await page.goto("/studios");

    const rows = page.getByTestId("studio-row");
    await expect(rows).toHaveCount(3);

    // Default order: created_at DESC (most recent at the top).
    await expect(rows.first().getByTestId("studio-name")).toHaveText(/terceiro/i);
    await expect(rows.last().getByTestId("studio-name")).toHaveText(/primeiro/i);
  });

  test.skip("seeded studios can be sorted by name", async ({ page }) => {
    await seedStudio(page, "Carla", 50);
    await seedStudio(page, "Bruno", 60);
    await seedStudio(page, "Ana", 70);

    await page.goto("/studios");

    const rows = page.getByTestId("studio-row");
    await expect(rows).toHaveCount(3);

    const nameHeader = page.getByRole("button", { name: /^nome$/i });
    await nameHeader.click();

    const firstRowName = rows.first().getByTestId("studio-name");
    await expect(firstRowName).toHaveText(/ana/i);

    await nameHeader.click();
    await expect(firstRowName).toHaveText(/carla/i);
  });

  test.skip("seeded studios can be sorted numerically by valor/hora", async ({ page }) => {
    await seedStudio(page, "Alpha", 120);
    await seedStudio(page, "Bravo", 25);
    await seedStudio(page, "Charlie", 85);

    await page.goto("/studios");

    const rows = page.getByTestId("studio-row");
    await expect(rows).toHaveCount(3);

    const valueHeader = page.getByRole("button", { name: /^valor\/hora$/i });
    await valueHeader.click();

    const firstRowValue = rows.first().getByTestId("studio-hourly-rate");
    await expect(firstRowValue).toHaveText(/R\$\s*25,00/);

    await valueHeader.click();
    await expect(firstRowValue).toHaveText(/R\$\s*120,00/);
  });
});
