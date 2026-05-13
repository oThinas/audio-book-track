import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";
import { closeSeedPool, seedBook, seedChapter, seedStudio } from "./helpers/seed";

test.afterAll(async () => {
  await closeSeedPool();
});

async function seedNarrator(page: Page, name: string): Promise<{ id: string }> {
  const response = await page.request.post("/api/v1/narrators", { data: { name } });
  if (!response.ok()) throw new Error(`seedNarrator failed: ${response.status()}`);
  const body = (await response.json()) as { data: { id: string } };
  return { id: body.data.id };
}

async function seedEditor(page: Page, name: string, email: string): Promise<{ id: string }> {
  const response = await page.request.post("/api/v1/editors", { data: { name, email } });
  if (!response.ok()) throw new Error(`seedEditor failed: ${response.status()}`);
  const body = (await response.json()) as { data: { id: string } };
  return { id: body.data.id };
}

const PRICE_PER_HOUR_CENTS = 7500; // R$ 75,00/h

function expectedMinutes(seconds: number): string {
  if (seconds === 0) return "0min";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

test.describe("Chapter grouping", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("groups by editor with totals, bucket and clear (US1)", async ({ page, appServer }) => {
    const suffix = Date.now();
    const studio = await seedStudio(page, `Sonora ${suffix}`, 75);
    const editorA = await seedEditor(page, `Editor A ${suffix}`, `a-${suffix}@x.com`);
    const editorB = await seedEditor(page, `Editor B ${suffix}`, `b-${suffix}@x.com`);
    const narrator = await seedNarrator(page, `Narrador X ${suffix}`);

    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: `Grouping Book ${suffix}`,
      studioId: studio.id,
      pricePerHourCents: PRICE_PER_HOUR_CENTS,
    });

    // Editor A: 2 chapters reviewing (60s + 1800s = 1860s)
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "reviewing",
      editedSeconds: 60,
      editorId: editorA.id,
      narratorId: narrator.id,
    });
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 2,
      status: "reviewing",
      editedSeconds: 1800,
      editorId: editorA.id,
      narratorId: narrator.id,
    });
    // Editor B: 1 chapter completed (3600s)
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 3,
      status: "completed",
      editedSeconds: 3600,
      editorId: editorB.id,
      narratorId: narrator.id,
    });
    // No editor: 1 chapter pending (0s, no narrator either)
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 4,
      status: "pending",
      editedSeconds: 0,
    });

    await page.goto(`/books/${bookId}`);

    // Initial: flat table — control visible with "Agrupar por" label
    const trigger = page.getByTestId("chapter-grouping-trigger");
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveText(/Agrupar por/);

    // Open menu and pick Editor
    await trigger.click();
    await page.getByTestId("chapter-grouping-item-editor").click();
    // Close menu and wait for popup to detach
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    // URL updated
    await expect(page).toHaveURL(/groupBy=editor/);

    // Three groups: Editor A (largest), Editor B, then "Sem atribuição"
    const groupRows = page.locator('[data-testid^="chapter-group-row-editor-"]');
    await expect(groupRows).toHaveCount(3);

    // Editor B has 3600s = 1h → highest → should be first
    const editorBGroup = page.getByTestId(`chapter-group-row-editor-${editorB.id}`);
    const editorAGroup = page.getByTestId(`chapter-group-row-editor-${editorA.id}`);
    const unassignedGroup = page.getByTestId("chapter-group-row-editor-__unassigned__");
    await expect(editorBGroup).toBeVisible();
    await expect(editorAGroup).toBeVisible();
    await expect(unassignedGroup).toBeVisible();

    // Sum verification via formatter
    expect(
      await editorBGroup.locator(`[data-testid$="-seconds-${editorB.id}"]`).textContent(),
    ).toContain(expectedMinutes(3600));
    expect(
      await editorAGroup.locator(`[data-testid$="-seconds-${editorA.id}"]`).textContent(),
    ).toContain(expectedMinutes(60 + 1800));
    expect(
      await unassignedGroup.locator('[data-testid$="-seconds-__unassigned__"]').textContent(),
    ).toContain(expectedMinutes(0));

    // Counts
    expect(
      await editorBGroup.locator(`[data-testid$="-count-${editorB.id}"]`).textContent(),
    ).toContain("1 capítulo");
    expect(
      await editorAGroup.locator(`[data-testid$="-count-${editorA.id}"]`).textContent(),
    ).toContain("2 capítulos");

    // Earnings present on editor groups
    expect(
      await editorBGroup
        .locator(`[data-testid="chapter-group-earnings-${editorB.id}"]`)
        .textContent(),
    ).toContain("R$");

    // Groups start collapsed (FR-008): no leaf rows visible yet
    const leafRows = page.locator('tr[data-testid^="chapter-row-"]');
    await expect(leafRows).toHaveCount(0);
    // Expand Editor A by clicking anywhere on its row; leaves become visible
    await expect(editorAGroup).toHaveAttribute("aria-expanded", "false");
    await editorAGroup.click();
    await expect(editorAGroup).toHaveAttribute("aria-expanded", "true");
    await expect(leafRows.first()).toBeVisible();

    // Clear grouping by unchecking the selected dimension
    await trigger.click();
    await page.getByTestId("chapter-grouping-item-editor").click();
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(page).not.toHaveURL(/groupBy=/);
    // No group rows visible anymore
    await expect(page.locator('[data-testid^="chapter-group-row-"]')).toHaveCount(0);
  });

  test("groups by narrator places pending-no-narrator in 'Sem atribuição' (US2)", async ({
    page,
    appServer,
  }) => {
    const suffix = Date.now();
    const studio = await seedStudio(page, `Sonora N ${suffix}`, 75);
    const narratorA = await seedNarrator(page, `Narrador A ${suffix}`);

    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: `Narrator Book ${suffix}`,
      studioId: studio.id,
      pricePerHourCents: PRICE_PER_HOUR_CENTS,
    });

    // 2 chapters with narratorA
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "editing",
      narratorId: narratorA.id,
    });
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 2,
      status: "editing",
      narratorId: narratorA.id,
      editedSeconds: 120,
    });
    // 1 chapter pending without narrator
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 3,
      status: "pending",
    });

    await page.goto(`/books/${bookId}`);
    const triggerN = page.getByTestId("chapter-grouping-trigger");
    await triggerN.click();
    await page.getByTestId("chapter-grouping-item-narrator").click();
    await triggerN.click();
    await expect(triggerN).toHaveAttribute("aria-expanded", "false");

    await expect(page).toHaveURL(/groupBy=narrator/);

    // 2 groups: narratorA + Sem atribuição
    const groups = page.locator('[data-testid^="chapter-group-row-narrator-"]');
    await expect(groups).toHaveCount(2);
    await expect(page.getByTestId(`chapter-group-row-narrator-${narratorA.id}`)).toBeVisible();
    await expect(page.getByTestId("chapter-group-row-narrator-__unassigned__")).toBeVisible();
  });

  test("URL with ?groupBy=editor loads page already grouped (shareable link)", async ({
    page,
    appServer,
  }) => {
    const suffix = Date.now();
    const studio = await seedStudio(page, `Share ${suffix}`, 75);
    const editor = await seedEditor(page, `Sharable ${suffix}`, `share-${suffix}@x.com`);

    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: `Share Book ${suffix}`,
      studioId: studio.id,
      pricePerHourCents: PRICE_PER_HOUR_CENTS,
    });
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "completed",
      editedSeconds: 3600,
      editorId: editor.id,
    });

    await page.goto(`/books/${bookId}?groupBy=editor`);
    await expect(page.getByTestId(`chapter-group-row-editor-${editor.id}`)).toBeVisible();
  });

  test("invalid groupBy param renders flat (FR-003)", async ({ page, appServer }) => {
    const suffix = Date.now();
    const studio = await seedStudio(page, `Invalid ${suffix}`, 75);
    const { id: bookId } = await seedBook({
      schema: appServer.schemaName,
      title: `Invalid Book ${suffix}`,
      studioId: studio.id,
      pricePerHourCents: PRICE_PER_HOUR_CENTS,
    });
    await seedChapter({
      schema: appServer.schemaName,
      bookId,
      number: 1,
      status: "pending",
    });

    await page.goto(`/books/${bookId}?groupBy=foo`);
    await expect(page.getByTestId("chapter-grouping-trigger")).toBeVisible();
    // No group rows
    await expect(page.locator('[data-testid^="chapter-group-row-"]')).toHaveCount(0);
  });
});
