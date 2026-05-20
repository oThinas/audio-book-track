import { expect } from "@playwright/test";

import { test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { seedBook, seedChapter, seedStudio } from "./helpers/seed";

test.describe("Dashboard — US3 — Overdue navigation", () => {
  test("Ver lista takes user to the book with the oldest overdue", async ({ page, appServer }) => {
    await login(page);

    const studio = await seedStudio(page, "Estúdio Overdue", 75);
    const book = await seedBook({
      schema: appServer.schemaName,
      title: "Livro com Atrasados",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    // overdue chapter (deadline in the past, active status)
    await seedChapter({
      schema: appServer.schemaName,
      bookId: book.id,
      position: 0,
      status: "editing",
      deadline: "2020-01-01",
    });

    await page.goto("/dashboard");

    const overdueBadge = page.getByRole("link", { name: /capítulos? atrasados?/i });
    await expect(overdueBadge).toBeVisible();
    await overdueBadge.click();

    await expect(page).toHaveURL(new RegExp(`/books/${book.id}\\?focus=week`));
  });
});
