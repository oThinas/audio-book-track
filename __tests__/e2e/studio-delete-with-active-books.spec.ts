import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { closeSeedPool, seedBook, seedChapter, seedStudio } from "./helpers/seed";

test.afterAll(async () => {
  await closeSeedPool();
});

test.describe("Studio delete — STUDIO_HAS_ACTIVE_BOOKS precondition", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("blocks delete with a 409 toast when the studio has a book with an active chapter", async ({
    page,
    appServer,
  }) => {
    const studioName = `Studio Bloqueio ${Math.random().toString(36).slice(2, 8)}`;
    const studio = await seedStudio(page, studioName, 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Livro Em Edição",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "editing",
    });

    await page.goto("/studios");
    const row = page.getByTestId("studio-row").filter({ hasText: studioName });
    await row.getByRole("button", { name: new RegExp(`excluir ${studioName}`, "i") }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/studios/${studio.id}`) && res.request().method() === "DELETE",
      ),
      dialog.getByRole("button", { name: /^excluir$/i }).click(),
    ]);
    expect(response.status()).toBe(409);

    // toast aparece com a mensagem do bloqueio
    await expect(page.getByText(/livro\(s\) com cap[íi]tulos ativos/i)).toBeVisible();
    await expect(page.getByText(/livro em edi[çc]ão/i)).toBeVisible();

    // Estúdio NÃO foi removido — ainda aparece na listagem
    await expect(page.getByTestId("studio-row").filter({ hasText: studioName })).toBeVisible();
  });

  test("allows soft-delete when all chapters are completed/paid; studio disappears from /studios", async ({
    page,
    appServer,
  }) => {
    const studioName = `Studio OK ${Math.random().toString(36).slice(2, 8)}`;
    const studio = await seedStudio(page, studioName, 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: "Livro Concluído",
      studioId: studio.id,
      pricePerHourCents: 7500,
    });
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "completed",
      editedSeconds: 3600,
    });
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 2,
      status: "paid",
      editedSeconds: 3600,
    });

    await page.goto("/studios");
    const row = page.getByTestId("studio-row").filter({ hasText: studioName });
    await row.getByRole("button", { name: new RegExp(`excluir ${studioName}`, "i") }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/studios/${studio.id}`) && res.request().method() === "DELETE",
      ),
      dialog.getByRole("button", { name: /^excluir$/i }).click(),
    ]);
    expect(response.status()).toBe(204);

    // Estúdio sumiu da listagem (soft-deleted).
    await expect(page.getByTestId("studio-row").filter({ hasText: studioName })).toHaveCount(0);
  });

  test("re-creating a studio with the same name reactivates the soft-deleted record (FR-046a)", async ({
    page,
  }) => {
    const studioName = `Reativar ${Math.random().toString(36).slice(2, 8)}`;

    // Cria, soft-deleta (sem livros bloqueando), depois recria com o mesmo nome.
    await seedStudio(page, studioName, 50);

    // Soft-delete via UI
    await page.goto("/studios");
    const row = page.getByTestId("studio-row").filter({ hasText: studioName });
    await row.getByRole("button", { name: new RegExp(`excluir ${studioName}`, "i") }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: /^excluir$/i }).click();
    await expect(page.getByTestId("studio-row").filter({ hasText: studioName })).toHaveCount(0);

    // Recria pelo mesmo nome com rate diferente — deve reativar (não criar duplicado).
    const response = await page.request.post("/api/v1/studios", {
      data: { name: studioName, defaultHourlyRateCents: 9000 },
    });
    expect(response.status()).toBe(200); // 200 = reativado (não 201)
    const body = (await response.json()) as { meta: { reactivated: boolean } };
    expect(body.meta.reactivated).toBe(true);

    // Recarrega /studios — o estúdio voltou.
    await page.goto("/studios");
    await expect(page.getByTestId("studio-row").filter({ hasText: studioName })).toBeVisible();
  });
});
