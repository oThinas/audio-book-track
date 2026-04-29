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
  ChapterEditorOrSecondsRequiredError,
  ChapterInvalidTransitionError,
  ChapterNarratorRequiredError,
  ChapterNotFoundError,
  ChapterPaidLockedError,
  ChapterReversionConfirmationRequiredError,
} from "@/lib/errors/chapter-errors";
import { EditorNotFoundError } from "@/lib/errors/editor-errors";
import { NarratorNotFoundError } from "@/lib/errors/narrator-errors";
import { createChapterService } from "@/lib/factories/chapter";
import { chapterIdParamsSchema, updateChapterSchema } from "@/lib/schemas/chapter";
import type { ChapterService } from "@/lib/services/chapter-service";

interface ChapterByIdDeps {
  readonly getSession: (args: { headers: Headers }) => Promise<Session | null>;
  readonly createService: () => ChapterService;
  readonly headersFn: () => Promise<Headers>;
}

function defaultDeps(): ChapterByIdDeps {
  return {
    getSession: (args) => auth.api.getSession(args) as Promise<Session | null>,
    createService: createChapterService,
    headersFn: headers,
  };
}

export async function handleChapterUpdate(
  request: Request,
  rawId: string,
  deps: ChapterByIdDeps,
): Promise<NextResponse> {
  const session = await deps.getSession({ headers: await deps.headersFn() });
  if (!session) {
    return unauthorizedResponse();
  }

  const params = chapterIdParamsSchema.safeParse({ id: rawId });
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

  const parsed = updateChapterSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const service = deps.createService();
  try {
    const { chapter, bookStatus } = await service.update(params.data.id, parsed.data);
    return NextResponse.json(
      {
        data: {
          id: chapter.id,
          bookId: chapter.bookId,
          number: chapter.number,
          status: chapter.status,
          narratorId: chapter.narratorId,
          editorId: chapter.editorId,
          editedSeconds: chapter.editedSeconds,
          createdAt: chapter.createdAt,
          updatedAt: chapter.updatedAt,
        },
        meta: { bookStatus },
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof ChapterNotFoundError) {
      return notFoundResponse("NOT_FOUND", error.message);
    }
    if (error instanceof ChapterPaidLockedError) {
      return conflictResponse("CHAPTER_PAID_LOCKED", error.message);
    }
    if (error instanceof ChapterInvalidTransitionError) {
      return unprocessableEntityResponse("INVALID_STATUS_TRANSITION", error.message);
    }
    if (error instanceof ChapterNarratorRequiredError) {
      return unprocessableEntityResponse("NARRATOR_REQUIRED", error.message);
    }
    if (error instanceof ChapterEditorOrSecondsRequiredError) {
      return unprocessableEntityResponse("EDITOR_OR_SECONDS_REQUIRED", error.message);
    }
    if (error instanceof ChapterReversionConfirmationRequiredError) {
      return unprocessableEntityResponse("REVERSION_CONFIRMATION_REQUIRED", error.message);
    }
    if (error instanceof NarratorNotFoundError) {
      return unprocessableEntityResponse("NARRATOR_NOT_FOUND", error.message);
    }
    if (error instanceof EditorNotFoundError) {
      return unprocessableEntityResponse("EDITOR_NOT_FOUND", error.message);
    }
    throw error;
  }
}

export async function handleChapterDelete(
  rawId: string,
  deps: ChapterByIdDeps,
): Promise<NextResponse> {
  const session = await deps.getSession({ headers: await deps.headersFn() });
  if (!session) {
    return unauthorizedResponse();
  }

  const params = chapterIdParamsSchema.safeParse({ id: rawId });
  if (!params.success) {
    return validationErrorResponse(params.error);
  }

  const service = deps.createService();
  try {
    const result = await service.delete(params.data.id);
    const responseHeaders = new Headers(NO_STORE_HEADERS);
    if (result.bookDeleted) {
      responseHeaders.set("X-Book-Deleted", "true");
    }
    return new NextResponse(null, { status: 204, headers: responseHeaders });
  } catch (error) {
    if (error instanceof ChapterNotFoundError) {
      return notFoundResponse("NOT_FOUND", error.message);
    }
    if (error instanceof ChapterPaidLockedError) {
      return conflictResponse("CHAPTER_PAID_LOCKED", error.message);
    }
    throw error;
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  return handleChapterUpdate(request, id, defaultDeps());
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  return handleChapterDelete(id, defaultDeps());
}
