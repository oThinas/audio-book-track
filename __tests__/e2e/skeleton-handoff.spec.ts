import { expect } from "@playwright/test";

import { test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

/**
 * US2 — skeleton -> content handoff. The Suspense fallback (loading.tsx) and
 * the resolved content share the same persistent <ViewTransition> boundary, so
 * the reveal crossfades (untyped update -> default vt-crossfade). Routes without
 * a loading.tsx (dashboard) must not surface a skeleton at all (no double
 * animation).
 */
test.describe("Page transitions — US2 — skeleton handoff", () => {
  test("skeleton hands off to content on a route with loading.tsx", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");

    // Defer the books navigation payload so the loading.tsx skeleton is observable.
    await page.route(
      (url) => url.pathname === "/books",
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 800));
        await route.continue();
      },
    );

    await page.getByTestId("sidebar").getByRole("link", { name: "Livros" }).click();

    // Skeleton appears during the deferred load...
    await expect(page.getByTestId("page-loading-skeleton").first()).toBeVisible();
    // ...then the resolved content replaces it (no skeleton left, URL settled).
    await expect(page).toHaveURL(/\/books$/);
    await expect(page.getByTestId("page-loading-skeleton")).toHaveCount(0);
  });

  test("instant route without loading.tsx shows no skeleton handoff", async ({ page }) => {
    await login(page);
    await page.goto("/books");

    // Dashboard has no loading.tsx — navigating there must not surface a skeleton.
    await page.getByTestId("sidebar").getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("page-loading-skeleton")).toHaveCount(0);
  });
});
