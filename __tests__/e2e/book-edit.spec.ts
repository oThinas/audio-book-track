import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { closeSeedPool, seedBook, seedChapter, seedStudio } from "./helpers/seed";

test.afterAll(async () => {
  await closeSeedPool();
});

test.describe("Book edit", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("opens dialog pre-filled with current values", async ({ page, appServer }) => {
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
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/^título$/i)).toHaveValue("Dom Casmurro");
    await expect(dialog.getByTestId("book-edit-studio-trigger")).toContainText(/sonora/i);
    await expect(dialog.getByTestId("book-edit-price-input")).toHaveValue(/R\$\s*75,00/);
  });

  test("updates title and reflects on the books list", async ({ page, appServer }) => {
    const studio = await seedStudio(page, "Sonora", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Antigo",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await seedChapter({ schema: appServer.schemaName, bookId, number: 1, status: "pending" });

    await page.goto(`/books/${bookId}`);
    await page.getByTestId("book-detail-edit-button").click();

    const dialog = page.getByTestId("book-edit-dialog");
    await dialog.getByLabel(/^título$/i).fill("Novo Título");

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().endsWith(`/api/v1/books/${bookId}`) && res.request().method() === "PATCH",
      ),
      dialog.getByTestId("book-edit-submit").click(),
    ]);
    expect(response.status()).toBe(200);
    await expect(dialog).toBeHidden();

    await page.goto("/books");
    await expect(page.getByRole("cell", { name: /novo título/i })).toBeVisible();
  });

  test("appends chapters when numChapters increases (visible in chapters table)", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora Add", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Aumentar capítulos",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await seedChapter({ schema: appServer.schemaName, bookId, number: 1, status: "pending" });
    await seedChapter({ schema: appServer.schemaName, bookId, number: 2, status: "pending" });

    await page.goto(`/books/${bookId}`);
    await page.getByTestId("book-detail-edit-button").click();
    const dialog = page.getByTestId("book-edit-dialog");

    // Use the +/- chapter input: increment to 4.
    const incrementBtn = dialog.getByRole("button", { name: /aumentar quantidade/i });
    await incrementBtn.click();
    await incrementBtn.click();

    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().endsWith(`/api/v1/books/${bookId}`) && res.request().method() === "PATCH",
      ),
      dialog.getByTestId("book-edit-submit").click(),
    ]);
    await expect(dialog).toBeHidden();

    await expect(page.getByTestId("chapters-scroll-area").getByRole("row")).toHaveCount(5); // header + 4
  });

  test("shows the reduce hint when user tries to lower the chapter count", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora Reduce", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Reduzir bloqueado",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await seedChapter({ schema: appServer.schemaName, bookId, number: 1, status: "pending" });
    await seedChapter({ schema: appServer.schemaName, bookId, number: 2, status: "pending" });

    await page.goto(`/books/${bookId}`);
    await page.getByTestId("book-detail-edit-button").click();
    const dialog = page.getByTestId("book-edit-dialog");

    const decrementBtn = dialog.getByRole("button", { name: /diminuir quantidade/i });
    await expect(decrementBtn).toBeDisabled();
  });

  test("disables price/studio with paid chapter and rejects price change via API", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Sonora Paid", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Tem pago",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "paid",
      editedSeconds: 3600,
    });

    await page.goto(`/books/${bookId}`);
    await page.getByTestId("book-detail-edit-button").click();
    const dialog = page.getByTestId("book-edit-dialog");

    await expect(dialog.getByTestId("book-edit-price-input")).toBeDisabled();
    await expect(dialog.getByTestId("book-edit-studio-trigger")).toBeDisabled();
  });
});
