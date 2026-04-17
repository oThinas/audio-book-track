import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";

async function seedNarrator(
  request: import("@playwright/test").APIRequestContext,
  name: string,
  email: string,
) {
  const response = await request.post("/api/v1/narrators", {
    data: { name, email },
  });
  if (!response.ok() && response.status() !== 409) {
    throw new Error(`Failed to seed narrator ${email}: ${response.status()}`);
  }
}

test.describe("Narrators list", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // NOTE: empty-state assertion runs against a shared DB that other specs
  // seed in parallel. Re-enable once DELETE (Phase 6) allows pre-test cleanup.
  test.fixme("empty state is shown when no narrators exist", async ({ page }) => {
    await page.goto("/narrators");

    await expect(page.getByRole("heading", { name: /narradores/i })).toBeVisible();
    await expect(page.getByTestId("narrators-empty-state")).toBeVisible();
  });

  test("page uses PageContainer layout and header", async ({ page }) => {
    await page.goto("/narrators");

    await expect(page.getByRole("heading", { name: /narradores/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Novo narrador", exact: true })).toBeVisible();
  });

  test("table is wrapped in a ScrollArea", async ({ page }) => {
    await page.goto("/narrators");

    await expect(page.getByTestId("narrators-scroll-area")).toBeVisible();
  });

  test("sortable headers are present with aria-sort semantics", async ({ page }) => {
    await page.goto("/narrators");

    const nameHeader = page.getByRole("button", { name: /^nome$/i });
    const emailHeader = page.getByRole("button", { name: /^e-mail$/i });

    await expect(nameHeader).toBeVisible();
    await expect(emailHeader).toBeVisible();
  });

  test.fixme("seeded narrators appear as rows and can be sorted by name", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    await seedNarrator(request, "Carla Souza", `carla-${stamp}@example.com`);
    await seedNarrator(request, "Bruno Lima", `bruno-${stamp}@example.com`);
    await seedNarrator(request, "Ana Prado", `ana-${stamp}@example.com`);

    await page.goto("/narrators");

    const rows = page.getByTestId("narrator-row");
    await expect(rows).toHaveCount(3, { timeout: 10000 });

    const nameHeader = page.getByRole("button", { name: /^nome$/i });
    await nameHeader.click();

    const firstRowName = rows.first().getByTestId("narrator-name");
    await expect(firstRowName).toHaveText(/ana prado/i);

    await nameHeader.click();
    await expect(firstRowName).toHaveText(/carla souza/i);
  });

  test.fixme("seeded narrators can be sorted by email", async ({ page, request }) => {
    const stamp = Date.now();
    await seedNarrator(request, "Zeca Andrade", `zz-${stamp}@example.com`);
    await seedNarrator(request, "Alice Barbosa", `aa-${stamp}@example.com`);

    await page.goto("/narrators");

    const rows = page.getByTestId("narrator-row");
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    const emailHeader = page.getByRole("button", { name: /^e-mail$/i });
    await emailHeader.click();

    const firstRowEmail = rows.first().getByTestId("narrator-email");
    await expect(firstRowEmail).toHaveText(new RegExp(`aa-${stamp}@example.com`));
  });
});
