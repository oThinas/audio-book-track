import { expect } from "@playwright/test";

import { test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { seedBook, seedStudio } from "./helpers/seed";

/**
 * US1 — directional page transitions. The persistent content boundary exposes
 * `data-vt-type` mirroring the resolved direction (contract C1/C2). The sidebar
 * lives outside the boundary, so it must stay stable across navigations.
 */
test.describe("Page transitions — US1 — directional navigation", () => {
  test("animates the content boundary on the vertical axis (menu order)", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");

    const sidebar = page.getByTestId("sidebar");
    const content = page.locator("[data-vt-type]");

    // dashboard (idx 0) -> books (idx 1) = nav-down
    await sidebar.getByRole("link", { name: "Livros" }).click();
    await expect(page).toHaveURL(/\/books$/);
    await expect(content).toHaveAttribute("data-vt-type", "nav-down");
    await expect(sidebar).toBeVisible();

    // books (idx 1) -> dashboard (idx 0) = nav-up
    await sidebar.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(content).toHaveAttribute("data-vt-type", "nav-up");
    await expect(sidebar).toBeVisible();
  });

  test("animates list <-> detail on the horizontal (depth) axis", async ({ page, appServer }) => {
    await login(page);
    const studio = await seedStudio(page, "Estúdio Transição", 60);
    const book = await seedBook({
      schema: appServer.schemaName,
      title: "Livro Transição",
      studioId: studio.id,
      pricePerHourCents: 6000,
    });

    await page.goto("/books");
    const content = page.locator("[data-vt-type]");

    // list -> detail = depth-forward
    await page.getByTestId(`book-row-${book.id}`).click();
    await expect(page).toHaveURL(new RegExp(`/books/${book.id}$`));
    await expect(content).toHaveAttribute("data-vt-type", "depth-forward");

    // detail -> list (Voltar) = depth-back
    await page.getByTestId("book-detail-back").click();
    await expect(page).toHaveURL(/\/books$/);
    await expect(content).toHaveAttribute("data-vt-type", "depth-back");
  });

  test("rapid navigation converges to the last destination with no residual animation", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await login(page);
    await page.goto("/dashboard");
    const sidebar = page.getByTestId("sidebar");

    // Fire two navigations back-to-back; the last one must win (FR-015).
    await sidebar.getByRole("link", { name: "Livros" }).click();
    await sidebar.getByRole("link", { name: "Estúdios" }).click();

    await expect(page).toHaveURL(/\/studios$/);
    await expect(page.getByRole("heading", { name: "Estúdios" })).toBeVisible();
    // No stuck/duplicate content from the abandoned transition.
    await expect(page.getByRole("heading", { name: "Livros" })).toHaveCount(0);

    // No residual view-transition animation once settled (FR-004): all vt-*
    // keyframe animations are torn down by the browser after the transition.
    await page.waitForFunction(
      () =>
        document.getAnimations().every((animation) => {
          const name = (animation as CSSAnimation).animationName ?? "";
          return !name.startsWith("vt-");
        }),
      undefined,
      { timeout: 5000 },
    );
    expect(pageErrors).toEqual([]);
  });

  test("runs the directional slide animation, not a crossfade", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");

    // Poll, from inside the page, for the view-transition keyframe names that
    // actually run during the navigation window.
    const collectNames = page.evaluate(async () => {
      const seen = new Set<string>();
      const start = performance.now();
      while (performance.now() - start < 1500) {
        for (const animation of document.getAnimations()) {
          const name = (animation as CSSAnimation).animationName;
          if (name?.startsWith("vt-")) {
            seen.add(name);
          }
        }
        await new Promise((resolve) => {
          requestAnimationFrame(() => resolve(undefined));
        });
      }
      return [...seen];
    });

    // Navigate while the poller runs (dashboard -> books = nav-down).
    await page.getByTestId("sidebar").getByRole("link", { name: "Livros" }).click();
    const names = await collectNames;

    // The directional full-viewport slide ran for the content boundary: nav-down
    // moves content up, so a vt-slide-*-up keyframe is present (the out/in pair
    // runs simultaneously — asserting either is enough and avoids poller-timing
    // flake). A vt-fade may also appear: the books loading.tsx -> content reveal
    // is an untyped crossfade by design (US2/D5 skeleton handoff), not the page
    // transition.
    expect(names.some((name) => name.startsWith("vt-slide-") && name.endsWith("-up"))).toBe(true);
  });
});
