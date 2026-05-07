import { headers as nextHeaders } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { type ErrorCode, errorCodes } from "@/lib/api/error-codes";
import { requestIdHeader } from "@/lib/api/headers";
import { requestContext } from "@/lib/api/request-context";
import { extractOrCreateRequestId } from "@/lib/api/request-id";
import { auth } from "@/lib/auth/server";
import type { Session } from "@/lib/auth/session";
import { DomainError } from "@/lib/errors/domain-error";
import { type ServerLogger, serverLogger } from "@/lib/logger/server-logger";

interface RouteContext<TParams> {
  readonly params: Promise<TParams>;
}

export interface AuthenticatedContext<TParams> {
  readonly params: Promise<TParams>;
  readonly session: Session;
  readonly requestId: string;
}

export interface PublicContext<TParams> {
  readonly params: Promise<TParams>;
  readonly session: null;
  readonly requestId: string;
}

export type AuthenticatedHandler<TParams> = (
  request: Request,
  context: AuthenticatedContext<TParams>,
) => Promise<NextResponse>;

export type PublicHandler<TParams> = (
  request: Request,
  context: PublicContext<TParams>,
) => Promise<NextResponse>;

export interface WithApiErrorHandlerOptions {
  /** When true (default), the wrapper resolves the session and replies 401 if missing. */
  readonly requireAuth?: boolean;
}

export interface WithApiErrorHandlerDeps {
  readonly logger: ServerLogger;
  readonly getSession: (args: { headers: Headers }) => Promise<Session | null>;
  readonly headersFn: () => Promise<Headers>;
}

const defaultDeps: WithApiErrorHandlerDeps = {
  logger: serverLogger,
  getSession: (args) => auth.api.getSession(args) as Promise<Session | null>,
  headersFn: nextHeaders,
};

interface ErrorEnvelope {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

function jsonError(envelope: ErrorEnvelope, requestId: string): NextResponse {
  const entry = errorCodes[envelope.code];
  const status = entry.status === 0 ? 500 : entry.status;
  return NextResponse.json(
    { error: envelope },
    {
      status,
      headers: requestIdHeader(requestId),
    },
  );
}

function withRequestIdHeader(response: NextResponse, requestId: string): NextResponse {
  if (!response.headers.has("X-Request-Id")) {
    response.headers.set("X-Request-Id", requestId);
  }
  return response;
}

function zodErrorToDetails(error: ZodError): ReadonlyArray<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

function mapError(error: unknown, requestId: string, logger: ServerLogger): NextResponse {
  if (error instanceof ZodError) {
    return jsonError(
      {
        code: "VALIDATION_ERROR",
        message: errorCodes.VALIDATION_ERROR.message,
        details: zodErrorToDetails(error),
      },
      requestId,
    );
  }

  if (error instanceof SyntaxError) {
    return jsonError({ code: "INVALID_BODY", message: errorCodes.INVALID_BODY.message }, requestId);
  }

  if (error instanceof DomainError) {
    const entry = errorCodes[error.code];
    return jsonError(
      {
        code: error.code,
        message: entry.message,
        details: error.getDetails?.(),
      },
      requestId,
    );
  }

  logger.error("Unhandled API error", { requestId, error });
  return jsonError(
    { code: "INTERNAL_ERROR", message: errorCodes.INTERNAL_ERROR.message },
    requestId,
  );
}

type AnyHandler<TParams> = (
  request: Request,
  context: {
    params: Promise<TParams>;
    session: Session | null;
    requestId: string;
  },
) => Promise<NextResponse>;

export function withApiErrorHandler<TParams = Record<string, never>>(
  handler: AuthenticatedHandler<TParams>,
  options?: { requireAuth?: true },
  deps?: WithApiErrorHandlerDeps,
): (request: Request, context: RouteContext<TParams>) => Promise<NextResponse>;
export function withApiErrorHandler<TParams = Record<string, never>>(
  handler: PublicHandler<TParams>,
  options: { requireAuth: false },
  deps?: WithApiErrorHandlerDeps,
): (request: Request, context: RouteContext<TParams>) => Promise<NextResponse>;
export function withApiErrorHandler<TParams = Record<string, never>>(
  handler: AuthenticatedHandler<TParams> | PublicHandler<TParams>,
  options: WithApiErrorHandlerOptions = {},
  deps: WithApiErrorHandlerDeps = defaultDeps,
): (request: Request, context: RouteContext<TParams>) => Promise<NextResponse> {
  const requireAuth = options.requireAuth ?? true;
  const anyHandler = handler as AnyHandler<TParams>;

  return async (request, context) => {
    const incomingHeaders = await deps.headersFn();
    const requestId = extractOrCreateRequestId(incomingHeaders);

    return requestContext.run({ requestId }, async () => {
      try {
        let session: Session | null = null;
        if (requireAuth) {
          session = await deps.getSession({ headers: incomingHeaders });
          if (!session) {
            return jsonError(
              { code: "UNAUTHORIZED", message: errorCodes.UNAUTHORIZED.message },
              requestId,
            );
          }
        }
        const response = await anyHandler(request, {
          params: context.params,
          session,
          requestId,
        });
        return withRequestIdHeader(response, requestId);
      } catch (error) {
        return mapError(error, requestId, deps.logger);
      }
    });
  };
}
