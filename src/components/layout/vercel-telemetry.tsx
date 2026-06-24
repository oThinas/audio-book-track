import { isTelemetryEnabled } from "@/lib/telemetry/is-telemetry-enabled";

/**
 * Mounts Vercel telemetry only on real production deployments. The gating
 * decision lives in the pure `isTelemetryEnabled` helper; this Server Component
 * (no "use client") just reads the environment and renders nothing on the
 * client when disabled — zero client weight in dev/test/E2E/preview.
 *
 * The enabled branch is filled incrementally by later phases: US1 mounts
 * <SpeedInsights /> and US2 mounts <Analytics />. Until then it renders null in
 * every environment.
 */
export function VercelTelemetry(): React.ReactNode {
  const enabled = isTelemetryEnabled({
    vercelEnv: process.env.VERCEL_ENV,
    e2eTestMode: process.env.E2E_TEST_MODE,
  });

  if (!enabled) {
    return null;
  }

  // US1 (Speed Insights) and US2 (Analytics) mount here in Phases 3 and 4.
  return null;
}
