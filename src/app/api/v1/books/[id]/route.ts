import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import {
  conflictResponse,
  notFoundResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "@/lib/api/responses";
import { auth } from "@/lib/auth/server";
import type { Session } from "@/lib/auth/session";
import {
  BookCannotReduceChaptersError,
  BookInlineStudioInvalidError,
  BookNotFoundError,
  BookPaidPriceLockedError,
  BookPaidStudioLockedError,
  BookStudioNotFoundError,
  BookTitleAlreadyInUseError,
} from "@/lib/errors/book-errors";
import { createBookService } from "@/lib/factories/book";
import { bookIdParamsSchema, updateBookSchema } from "@/lib/schemas/book";
import type { BookService } from "@/lib/services/book-service";

interface BookByIdDeps {
  readonly getSession: (args: { headers: Headers }) => Promise<Session | null>;
  readonly createService: () => BookService;
  readonly headersFn: () => Promise<Headers>;
}

function defaultDeps(): BookByIdDeps {
  return {
    getSession: (args) => auth.api.getSession(args) as Promise<Session | null>,
    createService: createBookService,
    headersFn: headers,
  };
}

export async function handleBookDetail(rawId: string, deps: BookByIdDeps): Promise<NextResponse> {
  const session = await deps.getSession({ headers: await deps.headersFn() });
  if (!session) {
    return unauthorizedResponse();
  }

  const parsed = bookIdParamsSchema.safeParse({ id: rawId });
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const service = deps.createService();
  const detail = await service.findById(parsed.data.id);
  if (!detail) {
    return notFoundResponse("NOT_FOUND", "Livro não encontrado");
  }

  return NextResponse.json({ data: detail }, { headers: NO_STORE_HEADERS });
}

export async function handleBookUpdate(
  request: Request,
  rawId: string,
  deps: BookByIdDeps,
): Promise<NextResponse> {
  const session = await deps.getSession({ headers: await deps.headersFn() });
  if (!session) {
    return unauthorizedResponse();
  }

  const params = bookIdParamsSchema.safeParse({ id: rawId });
  if (!params.success) {
    return validationErrorResponse(params.error);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return unprocessableEntityResponse(
      "VALIDATION_ERROR",
      "Corpo da requisição não é um JSON válido.",
    );
  }

  const parsed = updateBookSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const service = deps.createService();
  try {
    await service.update(params.data.id, parsed.data);
  } catch (error) {
    if (error instanceof BookNotFoundError) {
      return notFoundResponse("NOT_FOUND", error.message);
    }
    if (error instanceof BookCannotReduceChaptersError) {
      return unprocessableEntityResponse("CANNOT_REDUCE_CHAPTERS", error.message);
    }
    if (error instanceof BookStudioNotFoundError) {
      return unprocessableEntityResponse("STUDIO_NOT_FOUND", error.message);
    }
    if (error instanceof BookInlineStudioInvalidError) {
      return unprocessableEntityResponse("INLINE_STUDIO_INVALID", error.message);
    }
    if (error instanceof BookPaidPriceLockedError) {
      return conflictResponse("BOOK_PAID_PRICE_LOCKED", error.message);
    }
    if (error instanceof BookPaidStudioLockedError) {
      return conflictResponse("BOOK_PAID_STUDIO_LOCKED", error.message);
    }
    if (error instanceof BookTitleAlreadyInUseError) {
      return conflictResponse("TITLE_ALREADY_IN_USE", error.message);
    }
    throw error;
  }

  const detail = await service.findById(params.data.id);
  if (!detail) {
    return notFoundResponse("NOT_FOUND", "Livro não encontrado");
  }

  return NextResponse.json({ data: detail }, { headers: NO_STORE_HEADERS });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  return handleBookDetail(id, defaultDeps());
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  return handleBookUpdate(request, id, defaultDeps());
}
