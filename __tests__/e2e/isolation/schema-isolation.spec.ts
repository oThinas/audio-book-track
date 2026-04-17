import { expect, test } from "../fixtures/app-server";

test.describe.configure({ mode: "parallel" });

test.describe("Schema isolation across workers", () => {
  const sharedEmail = "isolation-probe@audiobook.local";

  test("worker-A signs up with shared email inside its own schema", async ({
    appServer,
    request,
  }, testInfo) => {
    test.skip(
      testInfo.config.workers === 1,
      "Cross-worker isolation cannot be verified with a single worker.",
    );

    const response = await request.post(`${appServer.baseURL}/api/auth/sign-up/email`, {
      data: {
        name: "Isolation Probe",
        email: sharedEmail,
        password: "probepwd123",
        username: `probe-${appServer.port}`,
      },
    });
    expect(response.ok()).toBe(true);
  });

  test("worker-B signs up with the SAME shared email (schema-isolated)", async ({
    appServer,
    request,
  }, testInfo) => {
    test.skip(
      testInfo.config.workers === 1,
      "Cross-worker isolation cannot be verified with a single worker.",
    );

    const response = await request.post(`${appServer.baseURL}/api/auth/sign-up/email`, {
      data: {
        name: "Isolation Probe",
        email: sharedEmail,
        password: "probepwd123",
        username: `probe-${appServer.port}`,
      },
    });
    expect(response.ok()).toBe(true);
  });
});
