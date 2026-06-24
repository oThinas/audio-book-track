import { describe, expect, it } from "vitest";

import {
  isTelemetryEnabled,
  type TelemetryEnvironment,
} from "@/lib/telemetry/is-telemetry-enabled";

describe("isTelemetryEnabled", () => {
  // Truth table from data-model.md §1
  it.each<[string, TelemetryEnvironment, boolean]>([
    ["production without E2E", { vercelEnv: "production", e2eTestMode: undefined }, true],
    ["production under E2E harness", { vercelEnv: "production", e2eTestMode: "1" }, false],
    ["preview deploy", { vercelEnv: "preview", e2eTestMode: undefined }, false],
    ["development deploy", { vercelEnv: "development", e2eTestMode: undefined }, false],
    ["local (no VERCEL_ENV)", { vercelEnv: undefined, e2eTestMode: undefined }, false],
    ["local under E2E harness", { vercelEnv: undefined, e2eTestMode: "1" }, false],
  ])("returns %s → %o = %s", (_label, env, expected) => {
    expect(isTelemetryEnabled(env)).toBe(expected);
  });

  it("enables when e2eTestMode is any value other than the literal '1'", () => {
    expect(isTelemetryEnabled({ vercelEnv: "production", e2eTestMode: "0" })).toBe(true);
    expect(isTelemetryEnabled({ vercelEnv: "production", e2eTestMode: "" })).toBe(true);
  });

  it("treats an empty environment object as disabled", () => {
    expect(isTelemetryEnabled({})).toBe(false);
  });

  it("does not mutate the argument", () => {
    const env: TelemetryEnvironment = { vercelEnv: "production", e2eTestMode: undefined };

    isTelemetryEnabled(env);

    expect(env).toEqual({ vercelEnv: "production", e2eTestMode: undefined });
  });

  it("is deterministic for the same input", () => {
    const env: TelemetryEnvironment = { vercelEnv: "production" };

    expect(isTelemetryEnabled(env)).toBe(isTelemetryEnabled(env));
  });
});
