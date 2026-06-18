import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { closeSeedPool, seedBook, seedChapter, seedStudio } from "./helpers/seed";

test.afterAll(async () => {
  await closeSeedPool();
});

// US1 — list row enter animation. The transient "entering" state is covered by
// the row/hook unit tests; here we assert the durable, non-racy guarantees that
// hold under any motion preference: rows present at initial load never animate
// (FR-005), and a freshly created row ends in the cleared "idle" state — proving
// the enter→idle cycle completed without leaving a row stuck mid-animation.
test.describe("List row enter animations (US1)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("narrators: initial rows stay idle and a created row settles to idle", async ({ page }) => {
    const existingName = "Narrador Existente";
    const seed = await page.request.post("/api/v1/narrators", { data: { name: existingName } });
    expect(seed.ok()).toBe(true);

    await page.goto("/narrators");
    const existing = page.getByTestId("narrator-row").filter({ hasText: existingName });
    await expect(existing).toHaveAttribute("data-row-state", "idle");
    await expect(
      page.locator('[data-testid="narrator-row"][data-row-state="entering"]'),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Novo narrador", exact: true }).click();
    const newRow = page.getByTestId("narrator-new-row");
    await newRow.getByLabel(/nome/i).fill("Narrador Animado");
    await newRow.getByRole("button", { name: /confirmar/i }).click();
    await expect(newRow).toBeHidden({ timeout: 10000 });

    const created = page.getByTestId("narrator-row").filter({ hasText: "Narrador Animado" });
    await expect(created).toBeVisible();
    await expect(created).toHaveAttribute("data-row-state", "idle");
  });

  test("editors: initial rows stay idle and a created row settles to idle", async ({ page }) => {
    const existingName = "Editor Existente";
    const seed = await page.request.post("/api/v1/editors", {
      data: { name: existingName, email: "existente@studio.com" },
    });
    expect(seed.ok()).toBe(true);

    await page.goto("/editors");
    const existing = page.getByTestId("editor-row").filter({ hasText: existingName });
    await expect(existing).toHaveAttribute("data-row-state", "idle");
    await expect(page.locator('[data-testid="editor-row"][data-row-state="entering"]')).toHaveCount(
      0,
    );

    await page.getByRole("button", { name: "Novo editor", exact: true }).click();
    const newRow = page.getByTestId("editor-new-row");
    await newRow.getByLabel(/^nome$/i).fill("Editor Animado");
    await newRow.getByLabel(/^e-mail$/i).fill("animado@studio.com");
    await newRow.getByRole("button", { name: /confirmar/i }).click();
    await expect(newRow).toBeHidden({ timeout: 10000 });

    const created = page.getByTestId("editor-row").filter({ hasText: "Editor Animado" });
    await expect(created).toBeVisible();
    await expect(created).toHaveAttribute("data-row-state", "idle");
  });

  test("studios: initial rows stay idle and a created row settles to idle", async ({ page }) => {
    const existingName = "Estúdio Existente";
    const seed = await page.request.post("/api/v1/studios", {
      data: { name: existingName, defaultHourlyRateCents: 7000 },
    });
    expect(seed.ok()).toBe(true);

    await page.goto("/studios");
    const existing = page.getByTestId("studio-row").filter({ hasText: existingName });
    await expect(existing).toHaveAttribute("data-row-state", "idle");
    await expect(page.locator('[data-testid="studio-row"][data-row-state="entering"]')).toHaveCount(
      0,
    );

    await page.getByRole("button", { name: "Novo estúdio", exact: true }).click();
    const newRow = page.getByTestId("studio-new-row");
    await newRow.getByLabel(/^nome$/i).fill("Estúdio Animado");
    await newRow.getByLabel(/^valor\/hora$/i).focus();
    await page.keyboard.type("8500");
    await newRow.getByRole("button", { name: /confirmar/i }).click();
    await expect(newRow).toBeHidden({ timeout: 10000 });

    const created = page.getByTestId("studio-row").filter({ hasText: "Estúdio Animado" });
    await expect(created).toBeVisible();
    await expect(created).toHaveAttribute("data-row-state", "idle");
  });

  test("chapters: initial rows stay idle and a created chapter settles to idle", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Anim Studio", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Anim Book",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await seedChapter({ schema: appServer.schemaName, bookId, number: 1, status: "pending" });

    await page.goto(`/books/${bookId}`);
    const firstRow = page
      .locator('[data-testid^="chapter-row-"]')
      .filter({ hasText: "Capítulo 1" });
    await expect(firstRow).toBeVisible();
    await expect(firstRow).toHaveAttribute("data-row-state", "idle");
    await expect(
      page.locator('[data-testid^="chapter-row-"][data-row-state="entering"]'),
    ).toHaveCount(0);

    await page.getByTestId("add-chapter-open").click();
    await expect(page.getByTestId("add-chapter-dialog")).toBeVisible();
    await page.getByTestId("add-chapter-submit").click();
    await expect(page.getByTestId("add-chapter-dialog")).toBeHidden();

    const created = page.locator('[data-testid^="chapter-row-"]').filter({ hasText: "Capítulo 2" });
    await expect(created).toBeVisible();
    await expect(created).toHaveAttribute("data-row-state", "idle");
  });
});
