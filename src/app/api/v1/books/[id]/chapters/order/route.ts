import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import { type AuthenticatedContext, withApiErrorHandler } from "@/lib/api/with-error-handler";
import { createChapterService } from "@/lib/factories/chapter";
import { bookIdParamsSchema } from "@/lib/schemas/book";
import { reorderChaptersSchema } from "@/lib/schemas/chapter";
import type { ChapterService } from "@/lib/services/chapter-service";

export interface ChaptersReorderRouteDeps {
  readonly createService: () => ChapterService;
}

const defaultRouteDeps: ChaptersReorderRouteDeps = {
  createService: createChapterService,
};

export async function handleChaptersReorder(
  request: Request,
  ctx: AuthenticatedContext<{ id: string }>,
  routeDeps: ChaptersReorderRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const { id: rawBookId } = await ctx.params;
  const params = bookIdParamsSchema.parse({ id: rawBookId });
  const body: unknown = await request.json();
  const parsed = reorderChaptersSchema.parse(body);
  const result = await routeDeps
    .createService()
    .reorder(params.id, parsed.orderedIds, parsed.expectedVersion);
  return NextResponse.json(
    { data: { chaptersVersion: result.chaptersVersion } },
    { headers: NO_STORE_HEADERS },
  );
}

export const PUT = withApiErrorHandler<{ id: string }>(handleChaptersReorder);
