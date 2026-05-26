import * as Sentry from "@sentry/nextjs";

import { DomainError } from "@/lib/errors/domain-error";

const dsn = process.env.SENTRY_DSN;

// TEMP DIAGNOSTIC: revert once the first event lands in Sentry.
// eslint-disable-next-line no-console
console.info("[sentry-init]", {
  has_dsn: Boolean(dsn),
  dsn_prefix: dsn?.slice(0, 30),
  node_env: process.env.NODE_ENV,
  release: process.env.APP_VERSION,
});

if (dsn) {
  Sentry.init({
    dsn,
    enabled: process.env.NODE_ENV === "production",
    debug: true,
    sampleRate: 1.0,
    tracesSampleRate: 0,
    release: process.env.APP_VERSION,
    beforeSend(event, hint) {
      const error = hint?.originalException;
      if (error instanceof DomainError) return null;
      return event;
    },
  });
}
