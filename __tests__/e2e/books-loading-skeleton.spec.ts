import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

/**
 * Server-side delay applied to the books data fetch (via the
 * e2e-data-delay-ms cookie + E2E_TEST_MODE, see src/lib/e2e/data-delay.ts)
 * so the loading.tsx frame is deterministically visible: the static
 * shell (with the skeleton) streams immediately while the data region
 * resolves ~1.5s later — mirroring a real slow-network navigation.
 */
const DATA_DELAY_MS = 1500;

test.describe("Books loading skeleton", () => {
  test("shows the loading frame during navigation and swaps to content", async ({ page }) => {
    await login(page);

    // Abort RSC prefetches for /books: in production Next.js 16
    // prefetches the full dynamic content (viewport/hover), which would
    // serve the navigation from cache and skip the loading state.
    await page.route("**/books*", async (route) => {
      const prefetch = await route.request().headerValue("next-router-prefetch");
      if (prefetch !== null) {
        await route.abort();
        return;
      }
      await route.continue();
    });

    // Slow down the server-side data fetch for /books only.
    await page.context().addCookies([
      {
        name: "e2e-data-delay-ms",
        value: String(DATA_DELAY_MS),
        url: new URL(page.url()).origin,
      },
    ]);

    // Fixed origin for the client-side navigation.
    await page.goto("/dashboard");

    await page.getByRole("link", { name: "Livros" }).click();

    // During the delay: real frame title + skeleton block visible.
    await expect(page.getByTestId("page-loading-skeleton")).toBeVisible();
    await expect(page.getByRole("heading", { name: /^livros$/i })).toBeVisible();
    await expect(page.getByTestId("page-loading-status")).toBeAttached();

    // After the swap: skeleton gone, data region (empty state) visible.
    await expect(page.getByTestId("books-empty-state")).toBeVisible();
    await expect(page.getByTestId("page-loading-skeleton")).toHaveCount(0);
  });
});
