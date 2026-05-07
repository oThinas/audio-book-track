import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import { type AuthenticatedContext, withApiErrorHandler } from "@/lib/api/with-error-handler";
import { updateStudioSchema } from "@/lib/domain/studio";
import { createStudioService, createStudioSoftDeleteDeps } from "@/lib/factories/studio";
import type { SoftDeleteStudioDeps, StudioService } from "@/lib/services/studio-service";

export interface StudioByIdRouteDeps {
  readonly createService: () => StudioService;
  readonly createSoftDeleteDeps: () => SoftDeleteStudioDeps;
}

const defaultRouteDeps: StudioByIdRouteDeps = {
  createService: createStudioService,
  createSoftDeleteDeps: createStudioSoftDeleteDeps,
};

export async function handleStudiosUpdate(
  request: Request,
  ctx: AuthenticatedContext<{ id: string }>,
  routeDeps: StudioByIdRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const body: unknown = await request.json();
  const parsed = updateStudioSchema.parse(body);
  const studio = await routeDeps.createService().update(id, parsed);
  return NextResponse.json({ data: studio }, { headers: NO_STORE_HEADERS });
}

export async function handleStudiosDelete(
  _request: Request,
  ctx: AuthenticatedContext<{ id: string }>,
  routeDeps: StudioByIdRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const { id } = await ctx.params;
  await routeDeps.createService().softDelete(id, routeDeps.createSoftDeleteDeps());
  return new NextResponse(null, { status: 204, headers: NO_STORE_HEADERS });
}

export const PATCH = withApiErrorHandler<{ id: string }>(handleStudiosUpdate);
export const DELETE = withApiErrorHandler<{ id: string }>(handleStudiosDelete);
