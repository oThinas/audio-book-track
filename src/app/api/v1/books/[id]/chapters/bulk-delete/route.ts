import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import { type AuthenticatedContext, withApiErrorHandler } from "@/lib/api/with-error-handler";
import { createChapterService } from "@/lib/factories/chapter";
import { bookIdParamsSchema } from "@/lib/schemas/book";
import { bulkDeleteChaptersSchema } from "@/lib/schemas/chapter";
import type { ChapterService } from "@/lib/services/chapter-service";

export interface ChaptersBulkDeleteRouteDeps {
  readonly createService: () => ChapterService;
}

const defaultRouteDeps: ChaptersBulkDeleteRouteDeps = {
  createService: createChapterService,
};

export async function handleChaptersBulkDelete(
  request: Request,
  ctx: AuthenticatedContext<{ id: string }>,
  routeDeps: ChaptersBulkDeleteRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const { id: rawBookId } = await ctx.params;
  const params = bookIdParamsSchema.parse({ id: rawBookId });
  const body: unknown = await request.json();
  const parsed = bulkDeleteChaptersSchema.parse(body);
  const result = await routeDeps.createService().bulkDelete(params.id, parsed.chapterIds);
  const responseHeaders = new Headers(NO_STORE_HEADERS);
  if (result.bookDeleted) {
    responseHeaders.set("X-Book-Deleted", "true");
  }
  if (result.chaptersVersion !== null) {
    responseHeaders.set("X-Chapters-Version", String(result.chaptersVersion));
  }
  return new NextResponse(null, { status: 204, headers: responseHeaders });
}

export const POST = withApiErrorHandler<{ id: string }>(handleChaptersBulkDelete);
