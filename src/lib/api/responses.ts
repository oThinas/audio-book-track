import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: { code: "UNAUTHORIZED", message: "Sessão não encontrada ou expirada." } },
    { status: 401 },
  );
}

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

export function notFoundResponse(code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status: 404 });
}

export function conflictResponse(code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status: 409 });
}

export function unprocessableEntityResponse(code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status: 422 });
}
