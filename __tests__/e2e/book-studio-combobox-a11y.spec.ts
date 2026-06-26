import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { closeSeedPool, seedBook, seedChapter, seedStudio } from "./helpers/seed";

// US2 (D1): the studio picker trigger is role="combobox" and must expose the
// required ARIA props (aria-haspopup + aria-controls) the WAI-ARIA combobox
// pattern needs. aria-controls is bound only while open, because the popover
// content is mounted on demand (a dangling id would trip axe's aria-valid-attr-value).

test.afterAll(async () => {
  await closeSeedPool();
});

test.describe("Accessibility: studio combobox ARIA", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("create dialog trigger exposes combobox ARIA props (closed + open)", async ({ page }) => {
    await seedStudio(page, "Sonora", 75);
    await page.goto("/books");
    await page.getByTestId("books-new-button").click();

    const dialog = page.getByTestId("book-create-dialog");
    const trigger = dialog.getByTestId("book-studio-trigger");

    // Closed: role + haspopup present, expanded false, no dangling aria-controls.
    await expect(trigger).toHaveAttribute("role", "combobox");
    await expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(await trigger.getAttribute("aria-controls")).toBeNull();

    // Open: expanded true and aria-controls points at the live listbox.
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(trigger).toHaveAttribute("aria-controls", "book-studio-listbox");
    await expect(page.locator("#book-studio-listbox")).toBeVisible();
  });

  test("edit dialog trigger exposes combobox ARIA props (closed + open)", async ({
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
    await seedChapter({ schema: appServer.schemaName, bookId, number: 1, status: "pending" });

    await page.goto(`/books/${bookId}`);
    await page.getByTestId("book-detail-edit-button").click();

    const dialog = page.getByTestId("book-edit-dialog");
    const trigger = dialog.getByTestId("book-edit-studio-trigger");

    await expect(trigger).toHaveAttribute("role", "combobox");
    await expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(await trigger.getAttribute("aria-controls")).toBeNull();

    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(trigger).toHaveAttribute("aria-controls", "book-edit-studio-listbox");
    await expect(page.locator("#book-edit-studio-listbox")).toBeVisible();
  });
});
