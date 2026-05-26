import * as Sentry from "@sentry/nextjs";

export interface ServerSentryContext {
  readonly requestId?: string | null;
  readonly userId?: string | null;
  readonly method?: string;
  readonly path?: string;
}

const FLUSH_TIMEOUT_MS = 2000;

/**
 * Captures an unexpected server-side exception, enriched with the current
 * request_id, user_id and route metadata. Use ONLY for errors that are NOT
 * `DomainError`/`ZodError`/`SyntaxError` — those are expected and handled
 * by `withApiErrorHandler`.
 *
 * Awaits `Sentry.flush()` before resolving so the Vercel serverless function
 * does not freeze before the envelope reaches Sentry's ingest endpoint.
 */
export async function captureServerException(
  error: unknown,
  context: ServerSentryContext,
): Promise<void> {
  Sentry.withScope((scope) => {
    if (context.requestId) scope.setTag("request_id", context.requestId);
    if (context.userId) scope.setUser({ id: context.userId });
    if (context.method) scope.setTag("method", context.method);
    if (context.path) scope.setTag("path", context.path);
    Sentry.captureException(error);
  });
  await Sentry.flush(FLUSH_TIMEOUT_MS);
}
