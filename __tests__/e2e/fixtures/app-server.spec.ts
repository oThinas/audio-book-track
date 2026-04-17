import { expect, test } from "./app-server";

test.describe("App server fixture", () => {
  test("provides schema name matching worker pattern", async ({ appServer }) => {
    expect(appServer.schemaName).toMatch(/^e2e_w\d+_[a-f0-9]{8}$/);
  });

  test("provides baseURL reachable at /api/health", async ({ appServer, request }) => {
    const response = await request.get(`${appServer.baseURL}/api/health`);
    expect(response.ok()).toBe(true);
  });

  test("baseURL matches fixture port", async ({ appServer }) => {
    expect(appServer.baseURL).toBe(`http://localhost:${appServer.port}`);
  });
});
