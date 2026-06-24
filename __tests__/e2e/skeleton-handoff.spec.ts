import { expect } from "@playwright/test";

import { test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

/**
 * US2 — skeleton -> content handoff. The Suspense fallback (loading.tsx) and the
 * resolved content share the same persistent <ViewTransition> boundary, so the
 * reveal happens inside it (untyped update -> default vt-crossfade). Routes
 * without a loading.tsx (dashboard) must not surface a skeleton (no double
 * animation).
 *
 * The skeleton is observed deterministically by slowing the SERVER-SIDE data
 * fetch (cookie e2e-data-delay-ms, see src/lib/e2e/data-delay.ts) so the static
 * shell streams first — delaying the network transport alone would deliver an
 * already-complete RSC and skip the loading frame.
 */
const DATA_DELAY_MS = 1500;

test.describe("Page transitions — US2 — skeleton handoff", () => {
  test("skeleton hands off to content inside the transition boundary", async ({ page }) => {
    await login(page);

    // Abort RSC prefetches for /books: Next 16 prefetches the full dynamic
    // content (viewport/hover), which would serve the navigation from cache and
    // skip the loading frame.
    await page.route("**/books*", async (route) => {
      const prefetch = await route.request().headerValue("next-router-prefetch");
      if (prefetch !== null) {
        await route.abort();
        return;
      }
      await route.continue();
    });

    // Slow the server-side data fetch for /books so loading.tsx streams first.
    await page.context().addCookies([
      {
        name: "e2e-data-delay-ms",
        value: String(DATA_DELAY_MS),
        url: new URL(page.url()).origin,
      },
    ]);

    await page.goto("/dashboard");
    await page.getByTestId("sidebar").getByRole("link", { name: "Livros" }).click();

    // The skeleton streams inside the content boundary, then swaps to content.
    const boundary = page.locator("[data-vt-type]");
    await expect(boundary.getByTestId("page-loading-skeleton")).toBeVisible();
    await expect(page).toHaveURL(/\/books$/);
    await expect(page.getByTestId("page-loading-skeleton")).toHaveCount(0);
    await expect(page.getByTestId("books-empty-state")).toBeVisible();
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
