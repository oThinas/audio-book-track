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
});
