/**
 * Gating input for Vercel telemetry. A plain object so the decision stays a
 * pure function — the caller reads `process.env`, never this module.
 */
export interface TelemetryEnvironment {
  vercelEnv?: string;
  e2eTestMode?: string;
}

/**
 * Telemetry is enabled if and only if running on a real Vercel production
 * deployment and not under the E2E harness. Preview/development deploys and
 * local runs stay off. Pure and deterministic — no I/O, no mutation.
 */
export function isTelemetryEnabled({ vercelEnv, e2eTestMode }: TelemetryEnvironment): boolean {
  return vercelEnv === "production" && e2eTestMode !== "1";
}
