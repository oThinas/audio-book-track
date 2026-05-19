import { expect } from "@playwright/test";

import { test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

test.describe("Dashboard — US4 — Retrospective chart", () => {
  test("section is visible when widget is enabled (default state)", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");

    await expect(page.getByText("Receita ao longo do período")).toBeVisible();
  });

  test("switching preset to this-year re-renders the section", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await expect(page.getByText("Receita ao longo do período")).toBeVisible();

    await page.getByRole("tab", { name: "Este ano" }).click();
    await page.waitForURL(/preset=this-year/, { timeout: 8000 });
    await expect(page.getByText("Receita ao longo do período")).toBeVisible({ timeout: 8000 });
  });
});
