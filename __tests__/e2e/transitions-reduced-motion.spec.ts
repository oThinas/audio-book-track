import { expect } from "@playwright/test";

import { test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

/**
 * US3 — reduced motion and graceful degradation. With prefers-reduced-motion
 * the swap is instant (animations collapse to 0s via the global @media block).
 * Without the View Transitions API the swap still works with no console errors.
 */
test.describe("Page transitions — US3 — reduced motion & degradation", () => {
  test("swaps instantly under prefers-reduced-motion without errors", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });

    await login(page);
    await page.goto("/dashboard");
    await page.getByTestId("sidebar").getByRole("link", { name: "Livros" }).click();

    await expect(page).toHaveURL(/\/books$/);
    await expect(page.getByRole("heading", { name: "Livros" })).toBeVisible();

    // 0s-duration animations never linger.
    await page.waitForFunction(
      () =>
        document.getAnimations().every((animation) => {
          const name = (animation as CSSAnimation).animationName ?? "";
          return !name.startsWith("vt-");
        }),
      undefined,
      { timeout: 3000 },
    );
    expect(pageErrors).toEqual([]);
  });

  test("degrades gracefully when the View Transitions API is absent", async ({ page }) => {
    const transitionErrors: string[] = [];
    page.on("pageerror", (error) => transitionErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && /transition/i.test(message.text())) {
        transitionErrors.push(message.text());
      }
    });

    // Simulate a browser without the API before any app code runs.
    await page.addInitScript(() => {
      (document as unknown as { startViewTransition?: unknown }).startViewTransition = undefined;
    });

    await login(page);
    await page.goto("/dashboard");
    await page.getByTestId("sidebar").getByRole("link", { name: "Livros" }).click();

    await expect(page).toHaveURL(/\/books$/);
    await expect(page.getByRole("heading", { name: "Livros" })).toBeVisible();
    expect(transitionErrors).toEqual([]);
  });
});
