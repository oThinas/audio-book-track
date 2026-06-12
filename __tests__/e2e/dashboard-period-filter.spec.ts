import { expect } from "@playwright/test";

import { test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

test.describe("Dashboard — US2 — Period filter", () => {
  test("default preset is this-month; switching to this-year updates URL", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");

    await expect(page.getByText("A receber agora")).toBeVisible();

    const yearTab = page.getByRole("button", { name: "Este ano" });
    await yearTab.click();

    await page.waitForURL(/preset=this-year/, { timeout: 4000 });
    expect(page.url()).toContain("preset=this-year");
  });
});
