import * as Sentry from "@sentry/nextjs";

export interface ServerSentryContext {
  readonly requestId?: string | null;
  readonly userId?: string | null;
  readonly method?: string;
  readonly path?: string;
}

/**
 * Captures an unexpected server-side exception, enriched with the current
 * request_id, user_id and route metadata. Use ONLY for errors that are NOT
 * `DomainError`/`ZodError`/`SyntaxError` — those are expected and handled
 * by `withApiErrorHandler`.
 */
export function captureServerException(error: unknown, context: ServerSentryContext): void {
  Sentry.withScope((scope) => {
    if (context.requestId) scope.setTag("request_id", context.requestId);
    if (context.userId) scope.setUser({ id: context.userId });
    if (context.method) scope.setTag("method", context.method);
    if (context.path) scope.setTag("path", context.path);
    Sentry.captureException(error);
  });
}
