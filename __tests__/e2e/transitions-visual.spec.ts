import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

const BREAKPOINTS = [320, 768, 1024, 1440] as const;

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
}

/**
 * Polish — visual stability of the view-transition boundary (SC-007, NFR-002)
 * and no layout shift during a transition (NFR-003). The project asserts visual
 * regression rather than pixel screenshots, so we check overflow per breakpoint
 * in both themes and measure CLS across a navigation.
 */
test.describe("Page transitions — visual stability", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const width of BREAKPOINTS) {
    test(`no horizontal overflow inside the boundary at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/books");
      await expect(page.getByRole("heading", { name: "Livros" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  test("no horizontal overflow in dark theme", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/settings");
    await page.getByText("Escuro", { exact: true }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.goto("/books");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("heading", { name: "Livros" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("navigation transition does not shift layout (CLS)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    await page.evaluate(() => {
      const store = window as unknown as { __cls: number };
      store.__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          };
          if (!shift.hadRecentInput) store.__cls += shift.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });

    await page.getByTestId("sidebar").getByRole("link", { name: "Livros" }).click();
    await expect(page).toHaveURL(/\/books$/);

    // Wait for the transition to settle deterministically (no vt-* animations left).
    await page.waitForFunction(
      () =>
        document.getAnimations().every((animation) => {
          const name = (animation as CSSAnimation).animationName ?? "";
          return !name.startsWith("vt-");
        }),
      undefined,
      { timeout: 5000 },
    );

    const cls = await page.evaluate(() => (window as unknown as { __cls?: number }).__cls ?? 0);
    expect(cls).toBeLessThan(0.1);
  });
});
