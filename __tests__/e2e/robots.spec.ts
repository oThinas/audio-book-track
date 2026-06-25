import { expect, test } from "./fixtures/app-server";

// No login: robots.txt must be reachable by anonymous crawlers (the proxy
// matcher excludes it) and must advertise a permissive, crawlable policy so
// the Lighthouse is-crawlable audit passes (SEO = 100).
test.describe("robots.txt", () => {
  test("is publicly reachable and permissive without a session", async ({ page }) => {
    const response = await page.goto("/robots.txt");

    expect(response?.status()).toBe(200);

    const body = (await response?.text()) ?? "";
    // Match whole lines (trim + lowercase) so the assertion is robust to
    // directive casing and avoids the "allow: /" ⊂ "disallow: /" substring trap.
    const lines = body.split(/\r?\n/).map((line) => line.trim().toLowerCase());

    expect(lines).toContain("user-agent: *");
    expect(lines).toContain("allow: /");
    expect(lines).not.toContain("disallow: /");
  });
});
