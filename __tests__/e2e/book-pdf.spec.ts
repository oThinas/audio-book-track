import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { closeSeedPool, seedBook, seedChapter, seedStudio } from "./helpers/seed";

test.afterAll(async () => {
  await closeSeedPool();
});

test.describe("Book PDF popover", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("save → reload → URL persists; 'Abrir em nova guia' aparece", async ({
    page,
    appServer,
  }) => {
    const studio = await seedStudio(
      page,
      `Studio PDF ${Math.random().toString(36).slice(2, 8)}`,
      75,
    );
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Livro com PDF",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "pending",
    });

    await page.goto(`/books/${bookId}`);

    // Estado inicial: nenhum PDF salvo
    await page.getByTestId("book-pdf-trigger").click();
    await expect(page.getByTestId("book-pdf-popover")).toBeVisible();
    await expect(page.getByTestId("book-pdf-open-link")).toHaveCount(0);

    // Salva uma URL válida
    await page.getByTestId("book-pdf-url-input").fill("https://example.com/livro.pdf");
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/books/${bookId}`) && res.request().method() === "PATCH",
      ),
      page.getByTestId("book-pdf-save-button").click(),
    ]);
    expect(response.status()).toBe(200);

    // Fecha o popover (caso ainda esteja aberto após save) e reabre para verificar o estado persistido.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("book-pdf-url-input")).toBeHidden();
    await page.getByTestId("book-pdf-trigger").click();
    const openLink = page.getByTestId("book-pdf-open-link");
    await expect(openLink).toBeVisible();
    await expect(openLink).toHaveAttribute("href", "https://example.com/livro.pdf");
    await expect(openLink).toHaveAttribute("target", "_blank");
    await expect(openLink).toHaveAttribute("rel", /noopener/);
    await expect(openLink).toHaveAttribute("rel", /noreferrer/);

    // Reload da página: URL persistida
    await page.reload();
    await page.getByTestId("book-pdf-trigger").click();
    await expect(page.getByTestId("book-pdf-url-input")).toHaveValue(
      "https://example.com/livro.pdf",
    );
  });

  test("rejects invalid URL with inline error and never PATCHes", async ({ page, appServer }) => {
    const studio = await seedStudio(
      page,
      `Studio PDF ${Math.random().toString(36).slice(2, 8)}`,
      75,
    );
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Livro Inválido",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "pending",
    });

    await page.goto(`/books/${bookId}`);
    await page.getByTestId("book-pdf-trigger").click();

    const input = page.getByTestId("book-pdf-url-input");
    await input.fill("ftp://example.com/file.pdf");

    // Botão Salvar fica desabilitado quando o RHF marca o form como inválido.
    const saveButton = page.getByTestId("book-pdf-save-button");
    await expect(saveButton).toBeDisabled();
    await expect(page.getByTestId("book-pdf-url-error")).toBeVisible();
  });

  test("clears the URL by saving an empty value", async ({ page, appServer }) => {
    const studio = await seedStudio(
      page,
      `Studio PDF ${Math.random().toString(36).slice(2, 8)}`,
      75,
    );
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Livro PDF Remover",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "pending",
    });

    // Pré-popula o pdfUrl via API
    const seedResponse = await page.request.patch(`/api/v1/books/${bookId}`, {
      data: { pdfUrl: "https://example.com/old.pdf" },
    });
    expect(seedResponse.status()).toBe(200);

    await page.goto(`/books/${bookId}`);
    await page.getByTestId("book-pdf-trigger").click();

    const input = page.getByTestId("book-pdf-url-input");
    await expect(input).toHaveValue("https://example.com/old.pdf");

    // Limpa o campo e salva
    await input.fill("");
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/books/${bookId}`) && res.request().method() === "PATCH",
      ),
      page.getByTestId("book-pdf-save-button").click(),
    ]);
    expect(response.status()).toBe(200);

    // Popover fechou; reabrindo, "Abrir em nova guia" sumiu.
    await page.getByTestId("book-pdf-trigger").click();
    await expect(page.getByTestId("book-pdf-open-link")).toHaveCount(0);
  });
});
