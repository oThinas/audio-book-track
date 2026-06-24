import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { isTelemetryEnabled } from "@/lib/telemetry/is-telemetry-enabled";

/**
 * Mounts Vercel telemetry only on real production deployments. The gating
 * decision lives in the pure `isTelemetryEnabled` helper; this Server Component
 * (no "use client") just reads the environment and renders nothing on the
 * client when disabled — zero client weight in dev/test/E2E/preview.
 *
 * When enabled it mounts Speed Insights (Web Vitals) and Analytics (cookieless
 * page views); both attribute routes automatically in the App Router.
 */
export function VercelTelemetry(): React.ReactNode {
  const enabled = isTelemetryEnabled({
    vercelEnv: process.env.VERCEL_ENV,
    e2eTestMode: process.env.E2E_TEST_MODE,
  });

  if (!enabled) {
    return null;
  }

  return (
    <>
      <SpeedInsights />
      <Analytics />
    </>
  );
}
