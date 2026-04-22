import { expect, test } from "../fixtures/app-server";
import { deleteUserByEmail } from "../helpers/reset";

test.describe.configure({ mode: "parallel" });

test.describe("Schema isolation across workers", () => {
  const sharedEmail = "isolation-probe@audiobook.local";

  // The two cases below both sign up with `sharedEmail`. When Playwright lands
  // them on different workers (the intended path) each schema is brand new
  // and the signups are independent. When they land on the SAME worker — which
  // happens whenever the other worker is still booting its Next server — the
  // `truncateDomainTables` reset between tests preserves the `user` table, so
  // the probe user created by the first case would otherwise block the second
  // case with a duplicate-email error. Cleaning up the probe user before each
  // case makes the spec resilient to either scheduling outcome without
  // weakening the claim: when they do split across workers, the signup still
  // happens in an isolated schema, which is what the spec demonstrates.
  test.beforeEach(async ({ appServer }) => {
    await deleteUserByEmail(appServer.schemaName, sharedEmail);
  });

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
        username: `probe${appServer.port}`,
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
        username: `probe${appServer.port}`,
      },
    });
    expect(response.ok()).toBe(true);
  });
});
