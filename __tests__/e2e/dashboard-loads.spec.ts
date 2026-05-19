import { expect } from "@playwright/test";

import { test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { seedBook, seedChapter, seedStudio } from "./helpers/seed";

test.describe("Dashboard — US1 — A receber agora", () => {
  test("loads /dashboard with the 'A receber agora' KPI", async ({ page, appServer }) => {
    await login(page);

    const studio = await seedStudio(page, "Estúdio Dashboard A", 75);
    const book = await seedBook({
      schema: appServer.schemaName,
      title: "Livro Dashboard A",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await seedChapter({
      schema: appServer.schemaName,
      bookId: book.id,
      position: 0,
      status: "completed",
      editedSeconds: 3600,
    });

    await page.goto("/dashboard");

    await expect(page.getByText("A receber agora")).toBeVisible();
    await expect(page.getByText(/R\$\s+\d/)).toBeVisible();
  });
});
