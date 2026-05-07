import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import { type AuthenticatedContext, withApiErrorHandler } from "@/lib/api/with-error-handler";
import { updateNarratorSchema } from "@/lib/domain/narrator";
import { createNarratorService, createNarratorSoftDeleteDeps } from "@/lib/factories/narrator";
import type { NarratorService, SoftDeleteNarratorDeps } from "@/lib/services/narrator-service";

export interface NarratorByIdRouteDeps {
  readonly createService: () => NarratorService;
  readonly createSoftDeleteDeps: () => SoftDeleteNarratorDeps;
}

const defaultRouteDeps: NarratorByIdRouteDeps = {
  createService: createNarratorService,
  createSoftDeleteDeps: createNarratorSoftDeleteDeps,
};

export async function handleNarratorsUpdate(
  request: Request,
  ctx: AuthenticatedContext<{ id: string }>,
  routeDeps: NarratorByIdRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const body: unknown = await request.json();
  const parsed = updateNarratorSchema.parse(body);
  const narrator = await routeDeps.createService().update(id, parsed);
  return NextResponse.json({ data: narrator }, { headers: NO_STORE_HEADERS });
}

export async function handleNarratorsDelete(
  _request: Request,
  ctx: AuthenticatedContext<{ id: string }>,
  routeDeps: NarratorByIdRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const { id } = await ctx.params;
  await routeDeps.createService().softDelete(id, routeDeps.createSoftDeleteDeps());
  return new NextResponse(null, { status: 204, headers: NO_STORE_HEADERS });
}

export const PATCH = withApiErrorHandler<{ id: string }>(handleNarratorsUpdate);
export const DELETE = withApiErrorHandler<{ id: string }>(handleNarratorsDelete);
