import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { closeSeedPool, seedBook, seedChapter, seedStudio } from "./helpers/seed";

test.afterAll(async () => {
  await closeSeedPool();
});

test.describe("Books detail", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("clicking a row navigates to the detail page with header and chapters", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Dom Casmurro",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    for (let i = 1; i <= 3; i += 1) {
      await seedChapter({
        schema: appServer.schemaName,
        bookId,
        number: i,
        status: i === 1 ? "completed" : "pending",
        editedSeconds: i === 1 ? 3600 : 0,
      });
    }

    await page.goto("/books");
    await page.getByTestId(`book-row-${bookId}`).click();

    await expect(page).toHaveURL(new RegExp(`/books/${bookId}$`));
    await expect(page.getByRole("heading", { name: /dom casmurro/i })).toBeVisible();
    await expect(page.getByTestId("book-detail-studio")).toContainText(/sonora/i);
    await expect(page.getByTestId("book-detail-price")).toContainText("R$ 75,00");
    await expect(page.getByTestId("book-detail-chapters-summary")).toContainText("1/3");

    const rows = page.locator('[data-testid^="chapter-row-"]');
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText("1");
  });

  test("back button returns to the books list", async ({ page, appServer }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Memórias",
      studioId: studio.id,
      pricePerHourCents: 6000,
    });
    await seedChapter({ schema: appServer.schemaName, bookId, number: 1, status: "pending" });

    await page.goto(`/books/${bookId}`);
    await expect(page.getByRole("heading", { name: /memórias/i })).toBeVisible();

    await page.getByTestId("book-detail-back").click();
    await expect(page).toHaveURL(/\/books$/);
  });

  test("renders the not-found page for unknown book id", async ({ page }) => {
    // With the route loading.tsx present, the server commits HTTP 200 to start
    // streaming the shell; notFound() then fires mid-stream and renders the
    // not-found UI client-side (the HTTP status stays 200 — Next.js streaming
    // contract). Assert the rendered UI rather than the response status.
    await page.goto(`/books/${crypto.randomUUID()}`);
    await expect(page.getByTestId("not-found-message")).toBeVisible();
  });

  test("double-clicking the status cell enters edit mode and opens the status dropdown", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Iracema",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: chapterId } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "editing",
      editedSeconds: 0,
    });

    await page.goto(`/books/${bookId}`);
    const row = page.getByTestId(`chapter-row-${chapterId}`);
    await expect(row).toHaveAttribute("data-mode", "view");

    // SC-001: a single double-click both enters edit mode AND opens the dropdown.
    await page.getByTestId(`chapter-cell-status-${chapterId}`).dblclick();

    await expect(row).toHaveAttribute("data-mode", "edit");
    await expect(page.getByRole("option", { name: "Em revisão" })).toBeVisible();
  });

  test("double-clicking each data cell activates that cell's control", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Senhora",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    // One chapter per cell, each fresh in view mode — avoids exiting edit between cells.
    const chapters: Record<string, string> = {};
    for (let i = 1; i <= 5; i += 1) {
      const { id } = await seedChapter({
        schema: appServer.schemaName,
        bookId,
        number: i,
        status: "editing",
        editedSeconds: 0,
      });
      chapters[["title", "narrator", "editor", "deadline", "editedSeconds"][i - 1]] = id;
    }

    await page.goto(`/books/${bookId}`);

    // Título → focuses the title input.
    await page.getByTestId(`chapter-cell-title-${chapters.title}`).dblclick();
    await expect(page.getByTestId(`chapter-title-${chapters.title}`)).toBeFocused();

    // Narrador → opens the narrator dropdown ("—" null option is always present).
    await page.getByTestId(`chapter-cell-narrator-${chapters.narrator}`).dblclick();
    await expect(page.getByTestId(`chapter-cell-narrator-${chapters.narrator}`)).not.toBeVisible();
    await expect(page.getByRole("option", { name: "—" }).first()).toBeVisible();
    await page.keyboard.press("Escape");

    // Editor → opens the editor dropdown.
    await page.getByTestId(`chapter-cell-editor-${chapters.editor}`).dblclick();
    await expect(page.getByRole("option", { name: "—" }).first()).toBeVisible();
    await page.keyboard.press("Escape");

    // Prazo → opens the calendar popover (its "Limpar" button is unique to it).
    await page.getByTestId(`chapter-cell-deadline-${chapters.deadline}`).dblclick();
    await expect(page.getByRole("button", { name: "Limpar" })).toBeVisible();
    await page.keyboard.press("Escape");

    // Horas → focuses the hours input.
    await page.getByTestId(`chapter-cell-editedSeconds-${chapters.editedSeconds}`).dblclick();
    await expect(page.getByTestId(`chapter-hours-${chapters.editedSeconds}`)).toBeFocused();
  });

  test("double-clicking a data cell leaves no native text-selection residue", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Lucíola",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: chapterId } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      title: "Capítulo Primeiro",
      status: "editing",
    });

    await page.goto(`/books/${bookId}`);
    await page.getByTestId(`chapter-cell-title-${chapterId}`).dblclick();

    // FR-007: the dblclick must not select the word under the cursor.
    const selection = await page.evaluate(() => window.getSelection()?.toString() ?? "");
    expect(selection).toBe("");
  });

  test("on a paid chapter only the status dropdown activates (PAID_LOCKED_FIELDS skipped)", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Ubirajara",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: chapterId } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "paid",
      editedSeconds: 3600,
    });

    await page.goto(`/books/${bookId}`);
    const row = page.getByTestId(`chapter-row-${chapterId}`);

    // Título is locked on paid → enters edit but the input stays disabled/unfocused.
    await page.getByTestId(`chapter-cell-title-${chapterId}`).dblclick();
    await expect(row).toHaveAttribute("data-mode", "edit");
    await expect(page.getByTestId(`chapter-title-${chapterId}`)).toBeDisabled();
    await expect(page.getByTestId(`chapter-title-${chapterId}`)).not.toBeFocused();
    await page.getByTestId(`chapter-cancel-${chapterId}`).click();
    await expect(row).toHaveAttribute("data-mode", "view");

    // Narrador is locked on paid → enters edit but the dropdown does NOT open.
    await page.getByTestId(`chapter-cell-narrator-${chapterId}`).dblclick();
    await expect(row).toHaveAttribute("data-mode", "edit");
    await expect(page.getByRole("option")).toHaveCount(0);
    await page.getByTestId(`chapter-cancel-${chapterId}`).click();
    await expect(row).toHaveAttribute("data-mode", "view");

    // Status remains editable on paid (reversion) → the dropdown opens.
    await page.getByTestId(`chapter-cell-status-${chapterId}`).dblclick();
    await expect(row).toHaveAttribute("data-mode", "edit");
    await expect(page.getByRole("option", { name: "Concluído" })).toBeVisible();
  });

  test("the pencil still enters edit without auto-activation; selection mode is a no-op", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Til",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: chapterId } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "editing",
    });

    await page.goto(`/books/${bookId}`);
    const row = page.getByTestId(`chapter-row-${chapterId}`);

    // FR-004: the pencil (a focusable native button) still enters edit WITHOUT
    // opening any control (activateField is null when entering via the pencil).
    await page.getByTestId(`chapter-edit-${chapterId}`).click();
    await expect(row).toHaveAttribute("data-mode", "edit");
    await expect(page.getByRole("option")).toHaveCount(0);
    await page.getByTestId(`chapter-cancel-${chapterId}`).click();
    await expect(row).toHaveAttribute("data-mode", "view");

    // FR-006: double-click is a no-op while bulk-selecting.
    await page.getByTestId("book-detail-enter-selection-mode").click();
    await expect(page.getByTestId("chapters-bulk-delete-bar")).toBeVisible();
    await page.getByTestId(`chapter-cell-status-${chapterId}`).dblclick();
    await expect(row).toHaveAttribute("data-mode", "view");
    await expect(page.getByTestId(`chapter-select-${chapterId}`)).toBeVisible();
  });
});
