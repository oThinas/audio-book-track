import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import { type AuthenticatedContext, withApiErrorHandler } from "@/lib/api/with-error-handler";
import { BookNotFoundError } from "@/lib/errors/book-errors";
import { createBookService } from "@/lib/factories/book";
import { bookIdParamsSchema, updateBookSchema } from "@/lib/schemas/book";
import type { BookService } from "@/lib/services/book-service";

export interface BookByIdRouteDeps {
  readonly createService: () => BookService;
}

const defaultRouteDeps: BookByIdRouteDeps = { createService: createBookService };

export async function handleBookDetail(
  _request: Request,
  ctx: AuthenticatedContext<{ id: string }>,
  routeDeps: BookByIdRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const params = bookIdParamsSchema.parse({ id });
  const detail = await routeDeps.createService().findById(params.id);
  if (!detail) {
    throw new BookNotFoundError(params.id);
  }
  return NextResponse.json({ data: detail }, { headers: NO_STORE_HEADERS });
}

export async function handleBookUpdate(
  request: Request,
  ctx: AuthenticatedContext<{ id: string }>,
  routeDeps: BookByIdRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const params = bookIdParamsSchema.parse({ id });
  const body: unknown = await request.json();
  const parsed = updateBookSchema.parse(body);
  const service = routeDeps.createService();
  await service.update(params.id, parsed);
  const detail = await service.findById(params.id);
  if (!detail) {
    throw new BookNotFoundError(params.id);
  }
  return NextResponse.json({ data: detail }, { headers: NO_STORE_HEADERS });
}

export const GET = withApiErrorHandler<{ id: string }>(handleBookDetail);
export const PATCH = withApiErrorHandler<{ id: string }>(handleBookUpdate);
