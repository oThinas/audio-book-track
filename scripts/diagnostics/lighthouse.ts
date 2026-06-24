// Lighthouse diagnostics driver (diagnostics contract §C1).
//
// Launches a standalone headless Chrome via chrome-launcher, connects Playwright
// over CDP to establish the admin session, then runs Lighthouse navigation
// audits (4 categories) for the key routes in both mobile and desktop profiles.
// Raw reports land in .lighthouse/ (gitignored); the curated summary is written
// by hand into docs/diagnostics/.
//
// Run against a production build: `bun run build && bun run start` (default
// http://localhost:3000), then `bun run diagnose:seed && bun run diagnose:lighthouse`.
// Override the target with DIAGNOSE_BASE_URL.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium, type Page } from "@playwright/test";
import lighthouse, { desktopConfig } from "lighthouse";

type FormFactor = "mobile" | "desktop";

interface Route {
  readonly slug: string;
  readonly path: string;
}

const FORM_FACTORS: ReadonlyArray<FormFactor> = ["mobile", "desktop"];

// Audited unauthenticated (before login) — /login redirects once a session exists.
const PUBLIC_ROUTES: ReadonlyArray<Route> = [
  { slug: "home", path: "/" },
  { slug: "login", path: "/login" },
];

// Audited with the admin session active.
const AUTH_ROUTES: ReadonlyArray<Route> = [
  { slug: "dashboard", path: "/dashboard" },
  { slug: "books", path: "/books" },
];

async function login(page: Page, baseURL: string): Promise<void> {
  // Mirrors __tests__/e2e/helpers/auth.ts, but with absolute URLs so it works
  // outside the Playwright test runner (no configured baseURL).
  await page.goto(`${baseURL}/login`);
  await page.locator("#username").fill("admin");
  await page.locator("#password").fill("admin123");
  await page.locator("#login-submit").click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 10_000 });
}

async function discoverBookDetailPath(page: Page): Promise<string | null> {
  // Book rows navigate via onClick (not <a href>), exposing the id through a
  // data-testid="book-row-<id>" attribute. Short timeout so the run still
  // completes the other audits when the list is empty.
  const firstRow = page.locator('[data-testid^="book-row-"]').first();
  try {
    await firstRow.waitFor({ state: "visible", timeout: 10_000 });
    const testId = await firstRow.getAttribute("data-testid");
    const bookId = testId?.replace(/^book-row-/, "");
    return bookId ? `/books/${bookId}` : null;
  } catch {
    return null;
  }
}

async function audit(
  url: string,
  slug: string,
  formFactor: FormFactor,
  port: number,
  outDir: string,
): Promise<void> {
  const result = await lighthouse(
    url,
    {
      port,
      output: ["html", "json"],
      logLevel: "error",
      // Keep the Playwright-established session cookie across the audit.
      disableStorageReset: true,
    },
    formFactor === "desktop" ? desktopConfig : undefined,
  );

  if (!result) {
    console.error(`Lighthouse returned no result for ${slug} (${formFactor}).`);
    return;
  }

  const reports = Array.isArray(result.report) ? result.report : [result.report];
  writeFileSync(join(outDir, `${formFactor}-${slug}.html`), reports[0] ?? "");
  writeFileSync(join(outDir, `${formFactor}-${slug}.json`), reports[1] ?? "");

  const scores = Object.values(result.lhr.categories).map(
    (category) => `${category.id}=${Math.round((category.score ?? 0) * 100)}`,
  );
  console.info(`[${formFactor}] ${slug}: ${scores.join(" ")}`);
}

async function main(): Promise<void> {
  const baseURL = process.env.DIAGNOSE_BASE_URL ?? "http://localhost:3000";
  const outDir = join(process.cwd(), ".lighthouse");
  mkdirSync(outDir, { recursive: true });

  // Playwright launches the browser and exposes a CDP port that Lighthouse
  // attaches to (the documented Playwright + Lighthouse pattern). Lighthouse
  // opens its own tab in the same browser, so the Playwright-established session
  // cookie is shared (kept across audits via disableStorageReset).
  const debugPort = Number(process.env.DIAGNOSE_DEBUG_PORT ?? 9222);
  const browser = await chromium.launch({
    headless: true,
    args: [`--remote-debugging-port=${debugPort}`],
  });

  try {
    const page = await browser.newPage();

    // Public routes first, before a session exists.
    for (const formFactor of FORM_FACTORS) {
      for (const route of PUBLIC_ROUTES) {
        await audit(`${baseURL}${route.path}`, route.slug, formFactor, debugPort, outDir);
      }
    }

    await login(page, baseURL);

    // Discover a real /books/:id from the list for the detail audit.
    await page.goto(`${baseURL}/books`);
    const detailHref = await discoverBookDetailPath(page);
    const authRoutes: Route[] = detailHref
      ? [...AUTH_ROUTES, { slug: "books-detail", path: detailHref }]
      : [...AUTH_ROUTES];
    if (!detailHref) {
      console.warn("No book row found on /books — skipping detail audit. Run diagnose:seed first.");
    }

    for (const formFactor of FORM_FACTORS) {
      for (const route of authRoutes) {
        await audit(`${baseURL}${route.path}`, route.slug, formFactor, debugPort, outDir);
      }
    }

    // Settings modal (@modal/(.)settings) snapshot: Lighthouse's snapshot/timespan
    // modes are only exposed through the Puppeteer-based user-flow API (startFlow).
    // This project standardizes on Playwright and does not install puppeteer-core,
    // so the modal capture is left to the operational baseline run. To enable it,
    // add puppeteer-core, connect it to this same --remote-debugging-port, open the
    // modal via getByTestId("sidebar").getByRole("link", { name: "Configurações" }),
    // then call flow.snapshot().
    console.warn(
      "Skipped settings-modal snapshot: requires Lighthouse's Puppeteer flow API. " +
        "See the note in scripts/diagnostics/lighthouse.ts to enable it.",
    );

    console.info(`Lighthouse reports written to ${outDir}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("diagnose:lighthouse failed:", error);
  process.exit(1);
});
