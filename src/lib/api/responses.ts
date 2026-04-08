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
