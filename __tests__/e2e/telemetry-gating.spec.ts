import { expect, test } from "./fixtures/app-server";
import { login } from "./helpers/auth";

// SC-003 / FR-003: Vercel telemetry must stay OFF outside real production.
// The E2E server runs without VERCEL_ENV=production, so VercelTelemetry renders
// null — no beacon request and no Vercel script should ever reach the page.
test.describe("Vercel telemetry gating", () => {
  test("does not load Speed Insights in the E2E (non-production) environment", async ({ page }) => {
    const speedInsightsRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/_vercel/speed-insights")) {
        speedInsightsRequests.push(req.url());
      }
    });

    await login(page);

    // Exercise both an authenticated route and a public one (soft + hard nav).
    await page.goto("/dashboard");
    await page.goto("/login");

    expect(speedInsightsRequests).toHaveLength(0);

    const speedInsightsScripts = await page.locator('script[src*="speed-insights"]').count();
    expect(speedInsightsScripts).toBe(0);
  });

  test("does not load Analytics in the E2E (non-production) environment", async ({ page }) => {
    const analyticsRequests: string[] = [];
    page.on("request", (req) => {
      // "/_vercel/insights" is the Analytics path; it does not match the
      // Speed Insights path "/_vercel/speed-insights".
      if (req.url().includes("/_vercel/insights")) {
        analyticsRequests.push(req.url());
      }
    });

    await login(page);

    await page.goto("/dashboard");
    await page.goto("/login");

    expect(analyticsRequests).toHaveLength(0);

    const analyticsScripts = await page.locator('script[src*="/_vercel/insights"]').count();
    expect(analyticsScripts).toBe(0);
  });
});
