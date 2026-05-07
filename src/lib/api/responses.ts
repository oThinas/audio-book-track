import { NextResponse } from "next/server";
import type { ZodError } from "zod";

/**
 * @deprecated Use `withApiErrorHandler` from `@/lib/api/with-error-handler` —
 * the wrapper resolves session and replies 401 automatically. This helper
 * remains only for legacy routes pending migration in tasks T022..T032.
 */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: { code: "UNAUTHORIZED", message: "Sessão não encontrada ou expirada." } },
    { status: 401 },
  );
}

/**
 * @deprecated Use `withApiErrorHandler` — the wrapper catches `ZodError`
 * automatically and emits a 422 VALIDATION_ERROR envelope.
 */
export function validationErrorResponse(error: ZodError): NextResponse {
  const details = error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

  return NextResponse.json(
    { error: { code: "VALIDATION_ERROR", message: "Dados inválidos.", details } },
    { status: 422 },
  );
}

/**
 * @deprecated Throw a `DomainError` subclass (`BookNotFoundError`,
 * `StudioNotFoundError`, etc.) and let `withApiErrorHandler` convert it.
 */
export function notFoundResponse(code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status: 404 });
}

/**
 * @deprecated Throw a `DomainError` subclass and let `withApiErrorHandler`
 * convert it.
 */
export function conflictResponse(code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status: 409 });
}

/**
 * @deprecated Throw a `DomainError` subclass and let `withApiErrorHandler`
 * convert it. For malformed JSON, the wrapper handles `SyntaxError`
 * automatically and emits 422 INVALID_BODY.
 */
export function unprocessableEntityResponse(code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status: 422 });
}
