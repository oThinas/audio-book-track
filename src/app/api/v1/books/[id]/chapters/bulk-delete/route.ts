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
import { BookNotFoundError } from "@/lib/errors/book-errors";
import { ChapterPaidLockedError, ChaptersNotInBookError } from "@/lib/errors/chapter-errors";
import { createChapterService } from "@/lib/factories/chapter";
import { bookIdParamsSchema } from "@/lib/schemas/book";
import { bulkDeleteChaptersSchema } from "@/lib/schemas/chapter";
import type { ChapterService } from "@/lib/services/chapter-service";

interface BulkDeleteDeps {
  readonly getSession: (args: { headers: Headers }) => Promise<Session | null>;
  readonly createService: () => ChapterService;
  readonly headersFn: () => Promise<Headers>;
}

function defaultDeps(): BulkDeleteDeps {
  return {
    getSession: (args) => auth.api.getSession(args) as Promise<Session | null>,
    createService: createChapterService,
    headersFn: headers,
  };
}

export async function handleChaptersBulkDelete(
  request: Request,
  rawBookId: string,
  deps: BulkDeleteDeps,
): Promise<NextResponse> {
  const session = await deps.getSession({ headers: await deps.headersFn() });
  if (!session) {
    return unauthorizedResponse();
  }

  const params = bookIdParamsSchema.safeParse({ id: rawBookId });
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

  const parsed = bulkDeleteChaptersSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const service = deps.createService();
  try {
    const result = await service.bulkDelete(params.data.id, parsed.data.chapterIds);
    const responseHeaders = new Headers(NO_STORE_HEADERS);
    if (result.bookDeleted) {
      responseHeaders.set("X-Book-Deleted", "true");
    }
    return new NextResponse(null, { status: 204, headers: responseHeaders });
  } catch (error) {
    if (error instanceof BookNotFoundError) {
      return notFoundResponse("NOT_FOUND", error.message);
    }
    if (error instanceof ChaptersNotInBookError) {
      return unprocessableEntityResponse("CHAPTERS_NOT_IN_BOOK", error.message);
    }
    if (error instanceof ChapterPaidLockedError) {
      return conflictResponse("CHAPTER_PAID_LOCKED", error.message);
    }
    throw error;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  return handleChaptersBulkDelete(request, id, defaultDeps());
}
