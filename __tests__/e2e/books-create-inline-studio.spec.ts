import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

test.describe("Books — inline studio creation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("creates a studio inline and propagates the book's price/hour to it", async ({ page }) => {
    const inlineStudioName = `Inline ${Math.random().toString(36).slice(2, 8)}`;

    await page.goto("/books");
    await page.getByTestId("books-new-button").click();

    const dialog = page.getByTestId("book-create-dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/^título$/i).fill("Dom Casmurro Inline");

    // Open the studio combobox and pick the "+ Novo Estúdio" item.
    await dialog.getByTestId("book-studio-trigger").click();
    await page.getByTestId("book-studio-inline-create").click();

    // The inline creator subform lives in the popover portal (outside the dialog node).
    const inlineCreator = page.getByTestId("studio-inline-creator");
    await expect(inlineCreator).toBeVisible();
    await inlineCreator.getByLabel(/^nome do est[úu]dio$/i).fill(inlineStudioName);

    const [studioResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().endsWith("/api/v1/studios") && res.request().method() === "POST",
      ),
      inlineCreator.getByTestId("studio-inline-create-submit").click(),
    ]);
    expect([200, 201]).toContain(studioResponse.status());

    // Studio is now selected; the trigger shows its name.
    await expect(dialog.getByTestId("book-studio-trigger")).toContainText(inlineStudioName);

    // Set Valor/hora to R$ 100,00. The MoneyInput auto-fills with the inline
    // studio's placeholder rate (R$ 0,01); Backspace clears one digit before
    // we type the desired amount cents-first.
    const priceInput = dialog.getByLabel(/^valor\/hora$/i);
    await priceInput.focus();
    await priceInput.press("Backspace");
    await priceInput.pressSequentially("10000");
    await expect(priceInput).toHaveValue(/R\$\s*100,00/);

    // Confirm the book creation.
    const [bookResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().endsWith("/api/v1/books") && res.request().method() === "POST",
      ),
      dialog.getByTestId("book-create-submit").click(),
    ]);
    expect(bookResponse.status()).toBe(201);

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("cell", { name: /dom casmurro inline/i })).toBeVisible();

    // Navigate to /studios and verify the inline studio shows R$ 100,00.
    await page.goto("/studios");
    const studioRow = page.getByRole("row", { name: new RegExp(inlineStudioName, "i") });
    await expect(studioRow).toBeVisible();
    await expect(studioRow).toContainText("R$ 100,00");
  });

  test("shows a warning toast when the user cancels after creating the inline studio", async ({
    page,
  }) => {
    const inlineStudioName = `Cancelado ${Math.random().toString(36).slice(2, 8)}`;

    await page.goto("/books");
    await page.getByTestId("books-new-button").click();
    const dialog = page.getByTestId("book-create-dialog");

    await dialog.getByTestId("book-studio-trigger").click();
    await page.getByTestId("book-studio-inline-create").click();

    const inlineCreator = page.getByTestId("studio-inline-creator");
    await inlineCreator.getByLabel(/^nome do est[úu]dio$/i).fill(inlineStudioName);
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().endsWith("/api/v1/studios") && res.request().method() === "POST",
      ),
      inlineCreator.getByTestId("studio-inline-create-submit").click(),
    ]);

    // Cancel the book dialog before submitting → studio is persisted with rate=R$ 0,01.
    await dialog.getByRole("button", { name: /cancelar/i }).click();

    await expect(page.getByText(/valor\/hora|R\$\s*0,01/i).first()).toBeVisible();

    // Studio should still appear in the studios list with R$ 0,01.
    await page.goto("/studios");
    const row = page.getByRole("row", { name: new RegExp(inlineStudioName, "i") });
    await expect(row).toBeVisible();
    await expect(row).toContainText("R$ 0,01");
  });
});
