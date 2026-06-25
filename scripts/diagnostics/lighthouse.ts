// Lighthouse diagnostics driver (diagnostics contract §C1).
//
// Playwright launches a headless Chromium exposing a CDP port; Lighthouse
// attaches to that port and runs navigation audits (4 categories) for the key
// routes in both mobile and desktop profiles. Authenticated routes are audited
// by forwarding the Playwright-established session cookie via the Cookie header
// — Lighthouse opens its own tab outside the Playwright context, so without the
// explicit header the proxy redirects every authenticated route to /login.
// Raw reports land in .lighthouse/ (gitignored); the curated summary is written
// by hand into docs/diagnostics/.
//
// Run against a production build: `bun run build && bun run start` (default
// http://localhost:3000), then `bun run diagnose:seed && bun run diagnose:lighthouse`.
// Override the target with DIAGNOSE_BASE_URL.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium, type Page } from "@playwright/test";
import lighthouse, { desktopConfig, startFlow } from "lighthouse";
import puppeteer from "puppeteer-core";

type FormFactor = "mobile" | "desktop";

interface Route {
  readonly slug: string;
  readonly path: string;
}

// Subset of the Playwright cookie shape forwarded to puppeteer-core.
interface SessionCookie {
  readonly name: string;
  readonly value: string;
  readonly domain: string;
  readonly path: string;
  readonly expires: number;
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite: "Strict" | "Lax" | "None";
}

const FORM_FACTORS: ReadonlyArray<FormFactor> = ["mobile", "desktop"];

// Audited unauthenticated. `/` is only a redirect gate (→ /login or the
// favorite page), not a distinct content page, so it is intentionally excluded.
const PUBLIC_ROUTES: ReadonlyArray<Route> = [{ slug: "login", path: "/login" }];

// Audited with the admin session (Cookie header). `/books/:id` is appended at runtime.
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
  extraHeaders?: Record<string, string>,
): Promise<void> {
  const result = await lighthouse(
    url,
    {
      port,
      output: ["html", "json"],
      logLevel: "error",
      disableStorageReset: true,
      ...(extraHeaders ? { extraHeaders } : {}),
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

  // Surface auth redirects: an authenticated route landing on /login means the
  // session cookie was not honored and the scores would be meaningless.
  const finalUrl = result.lhr.finalDisplayedUrl ?? "";
  if (slug !== "login" && /\/login(\?|$)/.test(finalUrl)) {
    console.warn(`[${formFactor}] ${slug}: REDIRECTED to /login — scores are NOT for this route.`);
  }

  const scores = Object.values(result.lhr.categories).map(
    (category) => `${category.id}=${Math.round((category.score ?? 0) * 100)}`,
  );
  console.info(`[${formFactor}] ${slug}: ${scores.join(" ")}  (final=${finalUrl})`);
}

// Settings modal (@modal/(.)settings) snapshot. Lighthouse's snapshot mode is
// only exposed through the Puppeteer-based user-flow API (startFlow), so connect
// puppeteer-core to the same CDP port Playwright already opened, reuse the admin
// session cookies, and open the intercepted modal via the sidebar link — a real
// client-side navigation; goto("/settings") would render the standalone page,
// not the modal — then snapshot the open Dialog.
async function captureSettingsModalSnapshot(
  baseURL: string,
  debugPort: number,
  cookies: readonly SessionCookie[],
  outDir: string,
): Promise<void> {
  const pupBrowser = await puppeteer.connect({ browserURL: `http://localhost:${debugPort}` });
  try {
    const pupPage = await pupBrowser.newPage();
    // Desktop viewport: the sidebar ([data-testid="sidebar"]) is hidden below the
    // md breakpoint (hidden md:flex), so the link would not be clickable.
    await pupPage.setViewport({ width: 1280, height: 800 });
    await pupPage.setCookie(
      ...cookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
      })),
    );
    await pupPage.goto(`${baseURL}/dashboard`, { waitUntil: "networkidle2" });
    await pupPage.click('[data-testid="sidebar"] a[href="/settings"]');
    await pupPage.waitForSelector('[role="dialog"]', { visible: true, timeout: 10_000 });

    const flow = await startFlow(pupPage);
    await flow.snapshot();

    writeFileSync(join(outDir, "settings-modal.html"), await flow.generateReport());
    writeFileSync(
      join(outDir, "settings-modal.json"),
      JSON.stringify(await flow.createFlowResult(), null, 2),
    );
    await pupPage.close();
    console.info(`[snapshot] settings-modal captured (final=${baseURL}/settings)`);
  } finally {
    // Detach without killing the browser — Playwright still owns it.
    pupBrowser.disconnect();
  }
}

async function main(): Promise<void> {
  const baseURL = process.env.DIAGNOSE_BASE_URL ?? "http://localhost:3000";
  const outDir = join(process.cwd(), ".lighthouse");
  mkdirSync(outDir, { recursive: true });

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

    // Forward the session cookie to Lighthouse. It opens its own tab outside the
    // Playwright context, so the cookie must be passed explicitly via the Cookie
    // header — otherwise the proxy redirects every authenticated route to /login.
    const cookies = await page.context().cookies();
    const authHeaders = { Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; ") };

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
        await audit(
          `${baseURL}${route.path}`,
          route.slug,
          formFactor,
          debugPort,
          outDir,
          authHeaders,
        );
      }
    }

    // Degrades gracefully: a missing link / modal logs and continues without
    // aborting the other audits (same posture as the /books/:id skip).
    try {
      await captureSettingsModalSnapshot(baseURL, debugPort, cookies, outDir);
    } catch (error) {
      console.warn(
        "Settings-modal snapshot skipped:",
        error instanceof Error ? error.message : error,
      );
    }

    console.info(`Lighthouse reports written to ${outDir}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("diagnose:lighthouse failed:", error);
  process.exit(1);
});
