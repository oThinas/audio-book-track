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
import { launch } from "chrome-launcher";
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

  const chrome = await launch({ chromeFlags: ["--headless=new", "--no-sandbox"] });
  const browser = await chromium.connectOverCDP(`http://localhost:${chrome.port}`);

  try {
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());

    // Public routes first, before a session exists.
    for (const formFactor of FORM_FACTORS) {
      for (const route of PUBLIC_ROUTES) {
        await audit(`${baseURL}${route.path}`, route.slug, formFactor, chrome.port, outDir);
      }
    }

    await login(page, baseURL);

    // Discover a real /books/:id from the list for the detail audit.
    await page.goto(`${baseURL}/books`);
    const detailHref = await page.locator('a[href^="/books/"]').first().getAttribute("href");
    const authRoutes: Route[] = detailHref
      ? [...AUTH_ROUTES, { slug: "books-detail", path: detailHref }]
      : [...AUTH_ROUTES];
    if (!detailHref) {
      console.warn(
        "No book link found on /books — skipping detail audit. Run diagnose:seed first.",
      );
    }

    for (const formFactor of FORM_FACTORS) {
      for (const route of authRoutes) {
        await audit(`${baseURL}${route.path}`, route.slug, formFactor, chrome.port, outDir);
      }
    }

    // Settings modal (@modal/(.)settings) snapshot: Lighthouse's snapshot/timespan
    // modes are only exposed through the Puppeteer-based user-flow API (startFlow).
    // This project standardizes on Playwright and does not install puppeteer-core,
    // so the modal capture is left to the operational baseline run. To enable it,
    // add puppeteer-core, connect it to this same chrome-launcher port, open the
    // modal via getByTestId("sidebar").getByRole("link", { name: "Configurações" }),
    // then call flow.snapshot().
    console.warn(
      "Skipped settings-modal snapshot: requires Lighthouse's Puppeteer flow API. " +
        "See the note in scripts/diagnostics/lighthouse.ts to enable it.",
    );

    console.info(`Lighthouse reports written to ${outDir}`);
  } finally {
    await browser.close();
    await chrome.kill();
  }
}

main().catch((error) => {
  console.error("diagnose:lighthouse failed:", error);
  process.exit(1);
});
