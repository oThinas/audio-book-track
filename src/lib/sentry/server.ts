import * as Sentry from "@sentry/nextjs";

export interface ServerSentryContext {
  readonly requestId?: string | null;
  readonly userId?: string | null;
  readonly method?: string;
  readonly path?: string;
}

/**
 * Captura uma exceção inesperada do server-side enriquecendo com o
 * request_id, user_id e dados da rota correntes. Use SOMENTE para
 * erros que não sejam `DomainError`/`ZodError`/`SyntaxError` — esses
 * são esperados e tratados pelo `withApiErrorHandler`.
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
