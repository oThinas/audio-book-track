import { expect } from "@playwright/test";

import { test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

/**
 * US3 — keyboard focus is preserved across a page transition. The animated
 * snapshots are pseudo-elements, so real focus lives on the live DOM; this
 * guards against focus being lost or trapped after the transition (SC-004).
 */
test.describe("Page transitions — US3 — keyboard focus", () => {
  test("keeps focus navigable after a keyboard-driven transition", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");

    const link = page.getByTestId("sidebar").getByRole("link", { name: "Livros" });
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/books$/);
    await expect(page.getByRole("heading", { name: "Livros" })).toBeVisible();

    // Focus is not stranded on <body>: Tab still advances to a focusable element.
    await page.keyboard.press("Tab");
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? "BODY");
    expect(focusedTag).not.toBe("BODY");
  });
});
