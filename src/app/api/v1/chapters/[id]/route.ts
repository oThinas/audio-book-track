import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import { type AuthenticatedContext, withApiErrorHandler } from "@/lib/api/with-error-handler";
import { createChapterService } from "@/lib/factories/chapter";
import { chapterIdParamsSchema, updateChapterSchema } from "@/lib/schemas/chapter";
import type { ChapterService } from "@/lib/services/chapter-service";

export interface ChapterByIdRouteDeps {
  readonly createService: () => ChapterService;
}

const defaultRouteDeps: ChapterByIdRouteDeps = {
  createService: createChapterService,
};

export async function handleChapterUpdate(
  request: Request,
  ctx: AuthenticatedContext<{ id: string }>,
  routeDeps: ChapterByIdRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const params = chapterIdParamsSchema.parse({ id });
  const body: unknown = await request.json();
  const parsed = updateChapterSchema.parse(body);
  const service = routeDeps.createService();
  const { chapter, bookStatus, chaptersVersion } = await service.update(params.id, parsed);
  return NextResponse.json(
    {
      data: {
        id: chapter.id,
        bookId: chapter.bookId,
        title: chapter.title,
        position: chapter.position,
        status: chapter.status,
        narratorId: chapter.narratorId,
        editorId: chapter.editorId,
        editedSeconds: chapter.editedSeconds,
        deadline: chapter.deadline,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
      },
      meta: { bookStatus, chaptersVersion },
    },
    { headers: NO_STORE_HEADERS },
  );
}

export async function handleChapterDelete(
  _request: Request,
  ctx: AuthenticatedContext<{ id: string }>,
  routeDeps: ChapterByIdRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const params = chapterIdParamsSchema.parse({ id });
  const result = await routeDeps.createService().delete(params.id);
  const responseHeaders = new Headers(NO_STORE_HEADERS);
  if (result.bookDeleted) {
    responseHeaders.set("X-Book-Deleted", "true");
  }
  if (result.chaptersVersion !== null) {
    responseHeaders.set("X-Chapters-Version", String(result.chaptersVersion));
  }
  return new NextResponse(null, { status: 204, headers: responseHeaders });
}

export const PATCH = withApiErrorHandler<{ id: string }>(handleChapterUpdate);
export const DELETE = withApiErrorHandler<{ id: string }>(handleChapterDelete);
