import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    enabled: process.env.NODE_ENV === "production",
    sampleRate: 1.0,
    tracesSampleRate: 0,
    release: process.env.APP_VERSION,
  });
}
