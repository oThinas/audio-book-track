import { vi } from "vitest";

import {
  type AuthenticatedContext,
  type AuthenticatedHandler,
  type PublicContext,
  type PublicHandler,
  type WithApiErrorHandlerDeps,
  withApiErrorHandler,
} from "@/lib/api/with-error-handler";
import type { Session } from "@/lib/auth/session";

/**
 * Build an `AuthenticatedContext` for direct invocation of route inner handlers
 * (those exported alongside `withApiErrorHandler` for unit/integration tests).
 *
 * The wrapper guarantees these fields in production; tests provide them inline
 * to skip the auth/error-mapping pipeline and exercise pure business logic.
 */
export function authenticatedContext<
  TParams extends Record<string, unknown> = Record<string, never>,
>(
  params: TParams = {} as TParams,
  options: { userId?: string; requestId?: string } = {},
): AuthenticatedContext<TParams> {
  return {
    params: Promise.resolve(params),
    session: { user: { id: options.userId ?? crypto.randomUUID() } },
    requestId: options.requestId ?? "test-request-id",
  };
}

export function publicContext<TParams extends Record<string, unknown> = Record<string, never>>(
  params: TParams = {} as TParams,
  options: { requestId?: string } = {},
): PublicContext<TParams> {
  return {
    params: Promise.resolve(params),
    session: null,
    requestId: options.requestId ?? "test-request-id",
  };
}

/**
 * Wrap an inner route handler with `withApiErrorHandler` using fake auth/headers/logger
 * so integration tests can exercise the full pipeline (auth check, error mapping,
 * X-Request-Id) against a real DB-backed service.
 *
 * Pass `session: null` to simulate an unauthenticated request; the wrapper will
 * reply 401 UNAUTHORIZED.
 */
export function wrapForTest<TParams = Record<string, never>>(
  handler: AuthenticatedHandler<TParams>,
  options?: {
    session?: Session | null;
    incomingHeaders?: Headers;
    logger?: WithApiErrorHandlerDeps["logger"];
  },
): (request: Request, context: { params: Promise<TParams> }) => Promise<Response>;
export function wrapForTest<TParams = Record<string, never>>(
  handler: PublicHandler<TParams>,
  options: {
    requireAuth: false;
    session?: null;
    incomingHeaders?: Headers;
    logger?: WithApiErrorHandlerDeps["logger"];
  },
): (request: Request, context: { params: Promise<TParams> }) => Promise<Response>;
export function wrapForTest<TParams = Record<string, never>>(
  handler: AuthenticatedHandler<TParams> | PublicHandler<TParams>,
  options: {
    session?: Session | null;
    incomingHeaders?: Headers;
    logger?: WithApiErrorHandlerDeps["logger"];
    requireAuth?: boolean;
  } = {},
) {
  const session =
    options.session === undefined ? { user: { id: crypto.randomUUID() } } : options.session;
  const deps: WithApiErrorHandlerDeps = {
    logger: options.logger ?? { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    getSession: vi.fn().mockResolvedValue(session),
    headersFn: vi.fn().mockResolvedValue(options.incomingHeaders ?? new Headers()),
  };
  if (options.requireAuth === false) {
    return withApiErrorHandler(handler as PublicHandler<TParams>, { requireAuth: false }, deps);
  }
  return withApiErrorHandler(handler as AuthenticatedHandler<TParams>, undefined, deps);
}
