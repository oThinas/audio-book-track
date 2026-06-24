import { expect } from "@playwright/test";

import { test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

/**
 * US4 — /settings as an intercepted modal over the current page (contract C3).
 * Client navigation opens a Dialog whose overlay covers the whole app (sidebar
 * included); closing restores the origin URL; deep-link/refresh renders the
 * standalone page.
 */
test.describe("Page transitions — US4 — settings modal", () => {
  test("opens /settings as a modal over the current page", async ({ page }) => {
    await login(page);
    await page.goto("/books");

    await page.getByTestId("sidebar").getByRole("link", { name: "Configurações" }).click();

    await expect(page).toHaveURL(/\/settings$/);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Configurações" })).toBeVisible();
    // Overlay covers the app (incl. the sidebar) — FR-009/FR-016.
    await expect(page.locator('[data-slot="dialog-overlay"]')).toBeVisible();
  });

  test("closes via Esc and restores the underlying route", async ({ page }) => {
    await login(page);
    await page.goto("/books");
    await page.getByTestId("sidebar").getByRole("link", { name: "Configurações" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/books$/);
  });

  test("closes when clicking the overlay over the sidebar", async ({ page }) => {
    await login(page);
    await page.goto("/books");
    await page.getByTestId("sidebar").getByRole("link", { name: "Configurações" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Clicking top-left (the sidebar's area, now under the overlay) dismisses the
    // modal — proving the overlay intercepts clicks meant for the sidebar.
    await page.locator('[data-slot="dialog-overlay"]').click({ position: { x: 8, y: 8 } });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/books$/);
  });

  test("browser back closes the modal", async ({ page }) => {
    await login(page);
    await page.goto("/books");
    await page.getByTestId("sidebar").getByRole("link", { name: "Configurações" }).click();
    await expect(page).toHaveURL(/\/settings$/);

    await page.goBack();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/books$/);
  });

  test("deep-link/refresh renders the standalone settings page", async ({ page }) => {
    await login(page);
    await page.goto("/settings");

    // No modal on a direct load — the standalone page renders instead (FR-011).
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();
  });
});
