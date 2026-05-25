import * as Sentry from "@sentry/nextjs";

export function initClientSentry(dsn: string | undefined, appVersion: string | undefined): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    enabled: process.env.NODE_ENV === "production",
    sampleRate: 1.0,
    tracesSampleRate: 0,
    release: appVersion,
  });
}
