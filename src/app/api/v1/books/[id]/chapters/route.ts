import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import { type AuthenticatedContext, withApiErrorHandler } from "@/lib/api/with-error-handler";
import { createChapterService } from "@/lib/factories/chapter";
import { bookIdParamsSchema } from "@/lib/schemas/book";
import { createChapterSchema } from "@/lib/schemas/chapter";
import type { ChapterService } from "@/lib/services/chapter-service";

export interface ChaptersCreateRouteDeps {
  readonly createService: () => ChapterService;
}

const defaultRouteDeps: ChaptersCreateRouteDeps = {
  createService: createChapterService,
};

export async function handleChaptersCreate(
  request: Request,
  ctx: AuthenticatedContext<{ id: string }>,
  routeDeps: ChaptersCreateRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const { id: rawBookId } = await ctx.params;
  const params = bookIdParamsSchema.parse({ id: rawBookId });
  const body: unknown = await request.json();
  const parsed = createChapterSchema.parse(body);
  const result = await routeDeps.createService().create(params.id, {
    title: parsed.title,
    position: parsed.position,
    expectedVersion: parsed.expectedVersion,
  });

  return NextResponse.json(
    {
      data: {
        chapter: {
          id: result.chapter.id,
          bookId: result.chapter.bookId,
          title: result.chapter.title,
          position: result.chapter.position,
          status: result.chapter.status,
          narratorId: result.chapter.narratorId,
          editorId: result.chapter.editorId,
          editedSeconds: result.chapter.editedSeconds,
          deadline: result.chapter.deadline,
          createdAt: result.chapter.createdAt,
          updatedAt: result.chapter.updatedAt,
        },
        bookStatus: result.bookStatus,
        chaptersVersion: result.chaptersVersion,
      },
    },
    { status: 201, headers: NO_STORE_HEADERS },
  );
}

export const POST = withApiErrorHandler<{ id: string }>(handleChaptersCreate);
