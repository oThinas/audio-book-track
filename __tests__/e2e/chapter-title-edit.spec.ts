import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { closeSeedPool, seedBook, seedChapter, seedStudio } from "./helpers/seed";

test.afterAll(async () => {
  await closeSeedPool();
});

test.describe("Inline edit do título de capítulo", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("input pré-popula com o título atual, aceita digitação e persiste a alteração", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(page, "Title Edit Studio", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Título Editável",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: chapterId } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "pending",
    });

    await page.goto(`/books/${bookId}`);

    // Enter edit mode.
    await page.getByTestId(`chapter-edit-${chapterId}`).click();
    const titleInput = page.getByTestId(`chapter-title-${chapterId}`);
    await expect(titleInput).toBeVisible();

    // Pre-populated with the current title.
    await expect(titleInput).toHaveValue("Capítulo 1");

    // Typing replaces the value (the regression: input stayed at the default
    // because Base UI's <Input> wrapped in <Controller> didn't propagate
    // onChange to react-hook-form's field state).
    await titleInput.fill("Novo Título");
    await expect(titleInput).toHaveValue("Novo Título");

    // Confirm and wait for the PATCH. The request body must carry the new
    // title — if the input regresses to non-controlled state, the submit
    // would send an empty patch (no diff) and the title would not change.
    const [patchResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/chapters/${chapterId}`) && res.request().method() === "PATCH",
      ),
      page.getByTestId(`chapter-confirm-${chapterId}`).click(),
    ]);
    expect(patchResponse.status()).toBe(200);
    const patchPayload = patchResponse.request().postDataJSON() as {
      title?: string;
    };
    expect(patchPayload.title).toBe("Novo Título");

    // Row exits edit mode and shows the new title.
    const row = page.getByTestId(`chapter-row-${chapterId}`);
    await expect(row).toHaveAttribute("data-mode", "view");
    await expect(row).toContainText("Novo Título");

    // Persisted: a hard reload still shows the new title.
    await page.reload();
    await expect(page.getByTestId(`chapter-row-${chapterId}`)).toContainText("Novo Título");
  });

  test("input bloqueia digitação quando o capítulo está pago", async ({ page, appServer }) => {
    const studio = await seedStudio(page, "Paid Title Lock", 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Livro com Capítulo Pago",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    const { id: paidId } = await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "paid",
      editedSeconds: 3600,
    });

    await page.goto(`/books/${bookId}`);
    await page.getByTestId(`chapter-edit-${paidId}`).click();
    const titleInput = page.getByTestId(`chapter-title-${paidId}`);
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toBeDisabled();
    await expect(titleInput).toHaveValue("Capítulo 1");
  });
});
