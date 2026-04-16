import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";

const KNOWN_MESSAGES = [
  "Esse capítulo ainda não foi escrito...",
  "Parece que o narrador pulou essa página...",
  "Esse trecho foi cortado na edição final...",
  "O audiobook acabou antes de chegar aqui...",
  "Essa página está em revisão... desde sempre...",
  "O editor esqueceu de incluir esse capítulo...",
  "Fim da gravação. Essa parte não existe...",
];

test.describe("Custom 404 Page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/this-route-does-not-exist");
  });

  test("should display 404 code", async ({ page }) => {
    await expect(page.getByText("404")).toBeVisible();
  });

  test("should display a themed message from the known set", async ({ page }) => {
    const messageElement = page.getByTestId("not-found-message");
    await expect(messageElement).toBeVisible();

    const text = await messageElement.textContent();
    expect(KNOWN_MESSAGES).toContain(text);
  });

  test("should render correctly on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByTestId("not-found-message")).toBeVisible();
  });

  test("should render correctly on desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByTestId("not-found-message")).toBeVisible();
  });
});
